var _ = require('lodash');
var assert = require('assert');

var user = require('../user');
var User = user.User;

var tasks = require('./tasks');
var AppTesterTasks = tasks.AppTesterTasks;
var TaskError = tasks.TaskError;


var CheckTasks = AppTesterTasks.extend(function(self, tester) {
    AppTesterTasks.call(self, tester);

    self.get_user = function() {
        var setup_user = self.tester.data.user;

        if (!setup_user) {
            throw new TaskError([
                "Cannot do any user checking,",
                "no user has been setup"
            ].join(' '));
        }

        var data = self.api.kv.store[setup_user.key()];
        var user = new User(self.im);
        user.init(setup_user.addr, data);
        return user;
    };

    self.get_reply = function() {
        return _.find(self.api.outbound.store, {
            in_reply_to: self.im.msg.message_id
        });
    };

    self.check_char_limit = function(n) {
        var reply = self.get_reply();

        if (typeof n == 'undefined') {
            n = self.tester.data.char_limit;
        }

        if (reply.content.length > n) {
            self.assert.fail({
                msg: [
                    "The reply content's character count was longer",
                    "than the expected limit:",
                    reply.content.length + " > " + n
                ].join(' '),
                actual: reply.content.length,
                expected: n
            });
        }
    };

    self.assertion = function(fn, opts) {
        try {
            fn();
        }
        catch(e) {
            if (e instanceof assert.AssertionError) {
                self.format_assertion_error(e, opts);
            } 

            throw e;
        }
    };

    self.format_assertion_error = function(e, opts) {
        opts = _.defaults(opts || {}, {diff: true});

        // explicitly control whether we want a diff or not
        e.showDiff = opts.diff;

        // mocha does some regexing to determine whether to include both the
        // context message and a pretty diff. I assume it is done this way
        // since it isn't easy to determine this any other way given just an
        // AssertionError, and that it checks for ': expected' since chaijs
        // adds this (since so many people use chaijs, it was probably
        // requested enough that it was merged in). We want the message to
        // display regardless, so as a workaround we append the ': expected'
        // when showing the diff. Thankfully, the appended text isn't actually
        // displayed. https://github.com/visionmedia/mocha/pull/993
        if (opts.msg) {
            e.msg = opts.msg;

            e.message = opts.diff
                ? opts.msg + ': expected'
                : opts.msg;
        }
    };

    self.assert = function(v, opts) {
        opts = opts || {};
        opts = _.defaults(opts, {diff: !opts.msg});

        self.assertion(function() {
            assert(v);
        }, opts);
    };

    self.assert.deepEqual = function(actual, expected, opts) {
        self.assertion(function() {
            assert.deepEqual(actual, expected);
        }, opts);
    };

    self.assert.strictEqual = function(actual, expected, opts) {
        self.assertion(function() {
            assert.strictEqual(actual, expected);
        }, opts);
    };

    self.assert.fail = function(opts) {
        opts = _.defaults(opts || {}, {diff: false});

        self.assertion(function() {
            assert.fail(opts.actual, opts.expected, null, opts.op);
        }, opts);
    };

    self.methods.check = function(fn) {
        /**:AppTester.check(fn)

        Allows custom assertions to be done after a sandbox run.

        :param function fn:
            function that will be performing the assertions. Takes the form
            ``func(api, im, app)``, where ``api`` is the tester's api instance
            (by default an instance of :class:`DummyApi`), ``im`` is the
            tester's :class:`InteractionMachine` instance, ``app`` is the
            sandbox app being tested and ``this`` is the :class:`AppTester`
            instance. May return a promise.

        .. code-block:: javascript

            tester.check(function(api, im, app) {
                assert.notDeepEqual(api.logs, []);
            });
        */
        return fn.call(self.tester, self.api, self.im, self.app);
    };

    self.methods.check.interaction = function(opts) {
        /**:AppTester.check.interaction(opts)

        Performs the checks typically done after a user has interacted with a
        sandbox app.

        :param string opts.state:
            the expected name of user's state at the end of the sandbox run.
        :param string opts.reply:
            the expected content of the reply message sent back to the user
            after the sandbox run. Optional.
        :param integer opts.char_limit:
            Checks that the content of the reply sent back to the user does not
            exceed the given character count. Optional.

        .. code-block:: javascript

            tester.check.interaction({
                state: 'initial_state',
                reply: 'Tea or coffee?'
            });
        */
        self.methods.check.user.state(opts.state);

        if ('reply' in opts) {
            self.methods.check.reply(opts.reply);
        }

        if ('char_limit' in opts) {
            self.methods.check.reply.char_limit(opts.char_limit);
        }
    };

    self.methods.check.user = function(v) {
        /**function:AppTester.check.user(obj)

        Checks that once serialized, the user deep equals ``obj``.

        :param object obj:
            the properties to check the user against

        .. code-block:: javascript

            tester.check.user({
                state: {name: 'coffee_state'},
                answers: {initial_state: 'coffee'}
            });
        */
        /**function:AppTester.check.user(fn)

        Passes the current user instance to the function ``fn``, allowing
        custom assertions to be done on the user. May return a promise.

        :param function fn:
            function of the form ``func(user)``, where ``user`` is the
            current user instance and ``this`` is the
            :class:`AppTester` instance.

        .. code-block:: javascript

            tester.check.user(function(user) {
                assert.equal(user.state.name, 'coffee_state');
                assert.equal(user.get_answer('initial_state', 'coffee');
            })
        */
        if (typeof v == 'object') {
            self.assert.deepEqual(self.get_user().serialize(), v, {
                msg: "Unexpected user properties"
            });
            return;
        }
        else if (typeof v == 'function') {
            return v.call(self.tester, self.get_user());
        }
    };


    self.methods.check.user.properties = function(obj) {
        /**function:AppTester.check.user.properties(obj)

        Checks that the expected properties given in ``obj`` are equal to
        the corresponding properties of the user after a sandbox run.

        :param object obj:
            the properties to check the user against

        .. code-block:: javascript

            tester.check.user.properties({
                lang: 'en',
                state: {name: 'coffee_state'},
                answers: {initial_state: 'coffee'}
            });
        */
        if ('state' in obj) {
            self.methods.check.user.state(obj.state);
        }

        if ('answers' in obj) {
            self.methods.check.user.answers(obj.answers);
        }

        if ('metadata' in obj) {
            self.methods.check.user.metadata(obj.metadata);
        }

        obj = _.omit(obj, 'state', 'answers', 'metadata');
        var user = self.get_user().serialize();
        var actuals = {};

        _.each(obj, function(value, key) {
            if (key in user) {
                actuals[key] = user[key];
            }
        });

        self.assert.deepEqual(actuals, obj, {
            msg: "Unexpected values for user properties"
        });
    };

    self.methods.check.user.answers = function(answers) {
        /**function:AppTester.check.user.answers(answers)

        Checks that the user's answers to states already encountered by the
        user match the expected ``answers``.

        :param object answers:
            (``state_name``, ``answer``) pairs for each state the user has
            encountered and answered

        .. code-block:: javascript

            tester.check.user.answers({
                initial_state: 'coffee',
                coffee_state: 'yes'
            });
        */
        var user = self.get_user().serialize();
        self.assert.deepEqual(user.answers, answers, {
            msg: "Unexpected user answers"
        });
    };

    self.methods.check.user.answer = function(state_name, answer) {
        /**function:AppTester.check.user.answer(state_name, answer)

        Checks that the user's answer to a state already encountered matches
        the expected ``answer``.

        :param string state_name:
            the name of the state to check the answer of.
        :param string answer:
            the expected answer by the user for the state

        .. code-block:: javascript

            tester.check.user.answer('initial_state', 'coffee');
        */
        var actual = self.get_user().get_answer(state_name);
        self.assert.strictEqual(actual, answer, {
            msg: "Unexpected user answer to state '" + state_name + "'"
        });
    };

    self.methods.check.user.lang = function(lang) {
        /**function:AppTester.check.user.lang(lang)

        Checks that the user's language matches the expected language
        code.

        :param string lang:
            the language code (e.g. 'sw', 'en', 'en_ZA') or ``null``
            to check that no language code is set.

        .. code-block:: javascript

            tester.check.user.lang('sw');
            tester.check.user.lang(null);
        */
        var actual = self.get_user().lang;
        self.assert.strictEqual(actual, lang, {
            msg: "Unexpected user language"
        });
    };

    self.methods.check.user.metadata = function(metadata) {
        /**function:AppTester.check.user.metadata(metadata)

        Checks that the user's metadata after a sandbox run deep equals the
        expected ``metadata``.

        :param object metadata:
            the expected metadata of the user

        .. code-block:: javascript

            tester.check.user.metadata({foo: 'bar'});
        */
        var user = self.get_user();
        self.assert.deepEqual(user.metadata, metadata, {
            msg: "Unexpected user metadata"
        });
    };

    self.methods.check.user.state = function(v) {
        /**function:AppTester.check.user.state(name)

        Checks that the name of the user's state after a sandbox run
        equals the expected ``name``.

        :param string name:
            the expected name of the current state

        .. code-block:: javascript

            tester.check.user.state('coffee_state');
        */
        /**function:AppTester.check.user.state(obj)

        Checks that the user's state after a sandbox run deep equals ``obj``.

        :param string obj.name:
            the expected name for the state
        :param object obj.metadata:
            the expected metadata for the state.
        :param object obj.creator_opts:
            the expected creator options for the state.

        .. code-block:: javascript

            tester.check.user.state({
                name: 'coffee_state',
                metadata: {foo: 'bar'},
                creator_opts: {baz: 'qux'}
            });
        */
        /**function:AppTester.check.user.state(fn)

        Passes the user's state data after a sandbox run to the function
        ``fn``, allowing custom assertions to be done on the state.

        :param function fn:
            function of the form ``func(state)``, where ``state`` is the
            current state instance and ``this`` is the
            :class:`AppTester` instance.

        .. code-block:: javascript

            tester.check.user.state(function(state) {
                assert.equal(state.name, 'coffee_state');
            })
        */
        var user = self.get_user();
        if (typeof v == 'function') {
            return v.call(self.tester, user.state);
        }
        else if (typeof v == 'string') {
            self.assert.deepEqual(user.state.name, v, {
                msg: "Unexpected user state name"
            });
            return;
        }
        else if (typeof v == 'object') {
            self.assert.deepEqual(user.state.serialize(), v, {
                msg: "Unexpected user state"
            });
            return;
        }
    };

    self.methods.check.user.state.metadata = function(metadata) {
        /**function:AppTester.check.user.state.metadata(metadata)

        Checks that the metadata of the interaction machine's current state
        after a sandbox run deep equals the expected ``metadata``.

        :param object metadata:
            the expected metadata of the current state

        .. code-block:: javascript

            tester.check.user.state.metadata({foo: 'bar'});
        */
        var user = self.get_user();
        self.assert.deepEqual(user.state.metadata, metadata, {
            msg: "Unexpected user state metadata"
        });
    };

    self.methods.check.user.state.creator_opts = function(opts) {
        /**function:AppTester.check.user.state.creator_opts(opts)

        Checks that the creator options of the interaction machine's current
        state after a sandbox run deep equals the expected options.

        :param object metadata:
            the expected metadata of the current state

        .. code-block:: javascript

            tester.check.user.state.creator_opts({foo: 'bar'});
        */
        var user = self.get_user();
        self.assert.deepEqual(user.state.creator_opts, metadata, {
            msg: "Unexpected user state creator options"
        });
    };

    self.methods.check.reply = function(v) {
        /**function:AppTester.check.reply(content)

        Checks that the content of the reply sent back to the user during the
        sandbox run equals the expected ``content``. Alias to
        :func:`AppTester.check.reply.content`.

        :param string content:
            the expected content of the sent out reply.

        .. code-block:: javascript

            tester.check.reply('Tea or coffee?');
        */
        /**function:AppTester.check.reply(re)

        Checks that the content of the reply sent back to the user during the
        sandbox run matches the regex.

        :param RegExp re:
            Regular expression to match the content of the sent out reply
            against.

        .. code-block:: javascript

            tester.check.reply.content(/Tea or coffee?/);
        */
        /**function:AppTester.check.reply(obj)

        Checks that the reply sent back to the user during the sandbox run
        deep equals ``obj``.

        :param object obj:
            the properties to check the reply against

        .. code-block:: javascript

            tester.check.reply({
                content: 'Tea or coffee?'
            });
        */
        /**function:AppTester.check.reply(fn)

        Passes the reply sent back to the user during the sandbox
        run to the function ``fn``, allowing custom assertions to be done on
        the reply.

        :param function fn:
            function of the form ``func(reply)``, where ``reply`` is the
            sent out reply and ``this`` is the :class:`AppTester` instance.

        .. code-block:: javascript

            tester.check.reply(function(reply) {
                assert.equal(reply.content, 'Tea or coffee?');
            })
        */
        self.check_char_limit();

        if (typeof v == 'function') {
            return v.call(self.tester, self.get_reply());
        }
        else if (typeof v == 'string' || v instanceof RegExp) {
            self.methods.check.reply.content(v);
            return;
        }
        else if (typeof v == 'object') {
            self.assert.deepEqual(self.get_reply(), v, {
                msg: "Unexpected reply"
            });
            return;
        }
    };

    self.methods.check.reply.properties = function(obj) {
        /**function:AppTester.check.reply.properties(obj)

        Checks that the expected properties given in ``obj`` are equal to the
        corresponding properties of the reply sent back to the user during the
        sandbox run.

        :param object obj:
            the properties to check the reply against

        .. code-block:: javascript

            tester.check.reply.properties({
                content: 'Tea or coffee?'
            });
        */
        var reply = self.get_reply();
        self.check_char_limit();

        if ('content' in obj) {
            self.methods.check.reply.content(obj.content);
        }

        var actuals = {};
        obj = _.omit(obj, 'content');
        _.each(obj, function(value, key) {
            if (key in reply) {
                actuals[key] = reply[key];
            }
        });

        self.assert.deepEqual(actuals, obj, {
            msg: "Unexpected values for reply properties"
        });
    };

    self.methods.check.reply.content = function(v) {
        /**function:AppTester.check.reply.content(content)

        Checks that the content of the reply sent back to the user during the
        sandbox run equals the expected ``content``. Alias to
        :func:`AppTester.check.reply.content`.

        :param string content:
            the expected content of the sent out reply.

        .. code-block:: javascript

            tester.check.reply.content('Tea or coffee?');
        */
        /**function:AppTester.check.reply.content(re)

        Checks that the content of the reply sent back to the user during the
        sandbox run matches the regex. Alias to
        :func:`AppTester.check.reply.content`.

        :param RegExp re:
            Regular expression to match the content of the sent out reply
            against.

        .. code-block:: javascript

            tester.check.reply.content(/Tea or coffee?/);
        */
        if (v instanceof RegExp) {
            self.methods.check.reply.content.re(v);
        } else {
            self.methods.check.reply.content.str(v);
        }
    };

    self.methods.check.reply.content.re = function(re) {
        var reply = self.get_reply();
        re = new RegExp(re);

        self.check_char_limit();

        self.assert(re.test(reply.content), {
            msg: [
                "Reply content '" + reply.content + "'",
                "did not match regular expression " + re
            ].join(' ')
        });
    };

    self.methods.check.reply.content.str = function(content) {
        var reply = self.get_reply();

        self.check_char_limit();

        self.assert.strictEqual(reply.content, content, {
            msg: "Unexpected reply content"
        });
    };

    self.methods.check.reply.ends_session = function() {
        /**function:AppTester.check.ends_session()

        Checks if the reply message sent to the user was set to end the
        session. This happens, for example, when the user reaches an
        :class:`EndState`.

        .. code-block:: javascript

            tester.check.reply.ends_session();
        */
        var reply = self.get_reply();

        self.assert(!reply.continue_session, {
            msg: "Reply did not end the session"
        });
    };

    self.methods.check.reply.char_limit = function(n) {
        /**function:AppTester.check.reply.char_limit(n)

        Checks that the content of the reply sent back to the user does not
        exceed the character count given by ``n``.

        :param integer n:
            the character count that the sent out reply's content is expected
            to not exceed.

        .. code-block:: javascript

            tester.check.reply.char_limit(10);
        */
       self.check_char_limit(n);
    };

    self.methods.check.no_reply = function() {
        /**function:AppTester.check.reply.content(content)

        Checks that no reply was sent back to the user.

        .. code-block:: javascript

            tester.check.no_reply();
        */
        self.assert.deepEqual(self.api.outbound.store, [], {
            msg: "Expecting no replies from the app to the user"
        });
    };
});


this.CheckTasks = CheckTasks;
