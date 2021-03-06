var Q = require('q');
var assert = require('assert');

var vumigo = require('../../lib');
var test_utils = vumigo.test_utils;
var App = vumigo.app.App;

var EndState = vumigo.states.EndState;
var Choice = vumigo.states.Choice;
var ChoiceState = vumigo.states.ChoiceState;

var AppTester = vumigo.tester.AppTester;
var TaskMethodError = vumigo.tester.TaskMethodError;


describe("AppTester Setup Tasks", function() {
    var api;
    var app;
    var tester;

    beforeEach(function() {
        app = new App('initial_state');
        tester = new AppTester(app);
        api = tester.api;

        app.states.add(new ChoiceState('initial_state', {
            question: "Tea or coffee?",
            choices: [
                new Choice('tea', 'Tea'),
                new Choice('coffee', 'Coffee')
            ],
            next: function(choice) {
                return {
                    tea: 'tea_state',
                    coffee: 'coffee_state'
                }[choice.value];
            }
        }));

        app.states.add(new EndState('coffee_state', {
            text: 'Cool'
        }));

        app.states.add(new EndState('tea_state', {
            send_reply: false
        }));
    });

    it("should set up a new user if only the user address has been given",
    function() {
        var p = tester.im.user.once.resolved('user:new');

        return tester.run().then(function() {
            assert(p.isFulfilled());
        });
    });

    it("should set up an exiting user if user fields have been given",
    function() {
        var p = tester.im.user.once.resolved('user:load');

        return tester
            .setup.user.addr('+273123')
            .setup.user.state('initial_state')
            .run()
            .then(function() {
                assert(p.isFulfilled());
            });
    });


    describe("if interaction tasks have already been scheduled", function() {
        beforeEach(function() {
            var interactions = tester.tasks.get('interactions');
            interactions.methods.interact = function() {};
            tester.tasks.attach();
        });

        it("should throw an error when scheduling setup tasks", function() {
            tester.interact();

            assert.throws(function() {
                tester.setup();
            }, TaskMethodError);
        });
    });

    describe("if checking tasks have already been scheduled", function() {
        beforeEach(function() {
            var checks = tester.tasks.get('checks');
            checks.methods.check = function() {};
            tester.tasks.attach();
        });

        it("should throw an error when scheduling setup tasks", function() {
            tester.check();

            assert.throws(function() {
                tester.setup();
            }, TaskMethodError);
        });
    });

    describe(".setup", function() {
        it("should call the given function with the api", function() {
            return tester
                .setup(function(api) {
                    api.config.store.foo = 'bar';
                })
                .run()
                .then(function() {
                    assert.equal(api.config.store.foo, 'bar');
                });
        });
    });

    describe(".setup.user", function() {
        describe(".setup.user(obj)", function() {
            it("should update the user data with the given properties",
            function() {
                return tester
                    .setup.user({addr: '+81'})
                    .setup.user({lang: 'jp'})
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+81'];
                        assert.equal(user.lang, 'jp');
                        assert.equal(user.addr, '+81');
                    });
            });
        });

        describe(".setup.user(fn)", function() {
            it("should set the user data with the function's result",
            function() {
                return tester
                    .setup.user(function(user) {
                        user.addr = '+81';
                        user.lang = 'jp';
                        return user;
                    })
                    .setup.user(function(user) {
                        delete user.lang;
                        return user;
                    })
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+81'];
                        assert.notEqual(user.lang, 'jp');
                        assert.equal(user.addr, '+81');
                    });
            });

            it("should allow the function to return its result via a promise",
            function() {
                return tester.setup.user(function() {
                    return Q({
                        addr: '+81',
                        lang: 'jp'
                    });
                }).run().then(function() {
                    var user = api.kv.store['users.test_app.+81'];
                    assert.equal(user.lang, 'jp');
                    assert.equal(user.addr, '+81');
                });
            });

            it("should bind the function to the tester instance", function() {
                return tester.setup.user(function() {
                    assert.strictEqual(this, tester);
                    return {};
                })
                .run();
            });
        });
    });

    describe(".setup.user.lang", function() {
        it("should set the user's language", function() {
            return tester.setup.user.lang('af').run().then(function() {
                var user = api.kv.store['users.test_app.+27123456789'];
                assert.equal(user.lang, 'af');
            });
        });
    });

    describe(".setup.user.addr", function() {
        it("should set the user's address", function() {
            return tester.setup.user.addr('+2798765').run().then(function() {
                var user = api.kv.store['users.test_app.+2798765'];
                assert.equal(user.addr, '+2798765');
            });
        });
    });

    describe(".setup.user.state", function() {
        describe(".setup.user.state(obj)", function() {
            it("should set the user's state's name", function() {
                return tester
                    .setup.user.state({name: 'initial_state'})
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+27123456789'];
                        assert.equal(user.state.name, 'initial_state');
                    });
            });

            it("should set the user's state metadata", function() {
                return tester
                    .setup.user.state({
                        name: 'initial_state',
                        metadata: {foo: 'bar'}
                    })
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+27123456789'];
                        assert.deepEqual(user.state.metadata, {foo: 'bar'});
                    });
            });
        });

        describe(".setup.user.state(name, opts)", function() {
            it("should set the user's state's name", function() {
                return tester
                    .setup.user.state('initial_state')
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+27123456789'];
                        assert.equal(user.state.name, 'initial_state');
                    });
            });

            it("should set the user's state metadata", function() {
                return tester
                    .setup.user.state('initial_state', {
                        metadata: {foo: 'bar'}
                    })
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+27123456789'];
                        assert.deepEqual(user.state.metadata, {foo: 'bar'});
                    });
            });

            it("should set the user's state creator opts", function() {
                return tester
                    .setup.user.state('initial_state', {
                        creator_opts: {foo: 'bar'}
                    })
                    .run()
                    .then(function() {
                        var user = api.kv.store['users.test_app.+27123456789'];
                        assert.deepEqual(user.state.creator_opts, {foo: 'bar'});
                    });
            });
        });
    });

    describe(".setup.user.state.metadata", function() {
        it("should update the user's state metadata", function() {
            return tester
                .setup.user.state('initial_state')
                .setup.user.state.metadata({foo: 'bar'})
                .setup.user.state.metadata({baz: 'qux'})
                .run()
                .then(function() {
                    var user = api.kv.store['users.test_app.+27123456789'];
                    assert.deepEqual(user.state.metadata, {
                        foo: 'bar',
                        baz: 'qux'
                    });
                });
        });
    });

    describe(".setup.user.answers", function() {
        it("should set the user's answers", function() {
            return tester.setup.user.answers({
                initial_state: 'coffee',
                coffee_state: 'yes'
            }).run().then(function() {
                var user = api.kv.store['users.test_app.+27123456789'];
                assert.equal(user.answers.initial_state, 'coffee');
                assert.equal(user.answers.coffee_state, 'yes');
            });
        });
    });

    describe(".setup.user.answer", function() {
        it("should set the user's answer to the given state", function() {
            return tester
                .setup.user.answer('initial_state', 'coffee')
                .run()
                .then(function() {
                    var user = api.kv.store['users.test_app.+27123456789'];
                    assert.deepEqual(user.answers.initial_state, 'coffee');
                });
        });
    });

    describe(".setup.user.metadata", function() {
        it("should update the user's metadata", function() {
            return tester
                .setup.user.metadata({foo: 'bar'})
                .setup.user.metadata({baz: 'qux'})
                .run()
                .then(function() {
                    var user = api.kv.store['users.test_app.+27123456789'];
                    assert.deepEqual(user.metadata, {
                        foo: 'bar',
                        baz: 'qux'
                    });
                });
        });
    });

    describe(".setup.config", function() {
        it("should update the sandbox config with the given properties",
        function() {
            return tester
                .setup.config({foo: 'bar'})
                .setup.config({baz: 'qux'})
                .run()
                .then(function() {
                    assert.equal(api.config.store.foo, 'bar');
                    assert.equal(api.config.json.foo, true);
                    assert.equal(api.config.store.baz, 'qux');
                    assert.equal(api.config.json.baz, true);
                });
        });

        it("should mark config as not-JSON if requested", function() {
            return tester
                .setup.config({foo: '<doc>xml</doc>'}, {json: false})
                .run()
                .then(function() {
                    assert.deepEqual(api.config.store.foo, '<doc>xml</doc>');
                    assert.deepEqual(api.config.json.foo, false);
                });
        });

        it("should update the sandbox's app config with the given properties",
        function() {
            return tester
                .setup.config.app({foo: 'bar'})
                .setup.config.app({baz: 'qux'})
                .run()
                .then(function() {
                    assert.equal(api.config.app.foo, 'bar');
                    assert.equal(api.config.app.baz, 'qux');
                });
        });

        it("should update the sandbox's endpoint config with the given endpoint",
        function() {
            return tester
                .setup.config.endpoint('sms_endpoint', {
                    delivery_class: 'sms'
                })
                .setup.config.endpoint('twitter_endpoint', {
                    delivery_class: 'twitter'})
                .run()
                .then(function() {
                    assert.deepEqual(api.config.app.endpoints, {
                        sms_endpoint: {delivery_class: 'sms'},
                        twitter_endpoint: {delivery_class: 'twitter'},
                    });
                });
        });

        it("should allow configuring endpoints without a delivery_class",
        function() {
            return tester
                .setup.config.endpoint('my_endpoint')
                .setup.config.endpoint('other_endpoint', {
                    extra: 'data'})
                .run()
                .then(function() {
                    assert.deepEqual(api.config.app.endpoints, {
                        my_endpoint: {},
                        other_endpoint: {extra: 'data'},
                    });
                });
        });
    });

    describe(".setup.kv", function() {
        describe(".setup.kv(obj)", function() {
            it("should update the kv data with the given properties",
            function() {
                return tester
                    .setup.kv({foo: 'bar'})
                    .setup.kv({baz: 'qux'})
                    .run()
                    .then(function() {
                        assert.equal(api.kv.store.foo, 'bar');
                        assert.equal(api.kv.store.baz, 'qux');
                    });
            });
        });
    });

    describe(".setup.char_limit", function() {
        it("should change the char limit used in the checking phase",
        function() {
            return tester
                .setup.char_limit(2)
                .setup.char_limit(3)
                .input()
                .check.reply([
                    'Tea or coffee?',
                    '1. Tea',
                    '2. Coffee'].join('\n'))
                .run()
                .then(test_utils.fail, function(e) {
                    assert.equal(e.msg, [
                        "The reply content's character count was longer",
                        "than the expected limit: 31 > 3"].join(' '));
                });
        });
    });
});
