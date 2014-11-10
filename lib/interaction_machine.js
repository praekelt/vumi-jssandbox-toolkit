var _ = require('lodash');
var Q = require('q');

var utils = require('./utils');
var BaseError = utils.BaseError;

var log = require('./log/api');
var Logger = log.Logger;

var contacts = require('./contacts/api');
var ContactStore = contacts.ContactStore;
var GroupStore = contacts.GroupStore;

var metrics = require('./metrics/api');
var MetricStore = metrics.MetricStore;

var user = require('./user');
var User = user.User;

var config = require('./config/api');
var SandboxConfig = config.SandboxConfig;
var IMConfig = config.IMConfig;

var outbound = require('./outbound/api');
var OutboundHelper = outbound.OutboundHelper;

var states = require("./states");
var StateData = states.StateData;
var StateExitEvent = states.StateExitEvent;
var StateEnterEvent = states.StateEnterEvent;
var StateResumeEvent = states.StateResumeEvent;

var events = require('./events');
var Event = events.Event;
var Eventable = events.Eventable;

var translate = require('./translate');
var Translator = translate.Translator;

var app = require('./app');
var App = app.App;


var ApiError = BaseError.extend(function(self, reply) {
    /**class:ApiError(message)
        Thrown when an error occurs when the sandbox api returns a failure
        response (when ``success`` is ``false``).

        :param object reply: the failure reply given by the api.
    */
    self.name = 'ApiError';
    self.reply = reply;
    self.message = self.reply.reason;
});


var IMEvent = Event.extend(function(self, name, im) {
    /**class:IMEvent

    An event relating to an interaction machine.

    :param string name:
        the event type's name.
    :param InteractionMachine im:
        the interaction machine associated to the event
    */
    Event.call(self, name);
    self.im = im;
});


var InboundMessageEvent = IMEvent.extend(function(self, im, cmd) {
    /**class:InboundMessageEvent(im, cmd)

    Emitted when an inbound user message is received by the interaction machine.

    :param InteractionMachine im:
        the interaction machine firing the event.
    :param object cmd:
        the API request cmd containing the inbound user message.
    */
    IMEvent.call(self, 'inbound_message', im);
    self.cmd = cmd;
    self.msg = cmd.msg;
});


var InboundEventEvent = IMEvent.extend(function(self, im, cmd) {
   /**class:InboundEventEvent(im, cmd)

    Emitted when an message status event is received. Typically, this is either
    an acknowledgement or a delivery report for an outbound message that was
    sent from the sandbox application.

    :param InteractionMachine im:
        the interaction machine emitting the event.
    :param object cmd:
        the API request cmd containing the inbound user message.

    The event type is ``inbound_event``.
    */
    IMEvent.call(self, 'inbound_event', im);
    self.cmd = cmd;
    self.event = cmd.msg;
});


var UnknownCommandEvent = IMEvent.extend(function(self, im, cmd) {
    /**class:UnknownCommandEvent(im, cmd)

    Emitted when a command without a handler is received.

    :param InteractionMachine im:
        the interaction machine emitting the event.
    :param object cmd:
        the API request that no command handler was found for.

    The event type is ``unknown_command``.
    */
    IMEvent.call(self, 'unknown_command', im);
    self.cmd = cmd;
});


var ReplyEvent = IMEvent.extend(function(self, im, content, continue_session) {
    /**class:ReplyEvent(im)

    Emitted after the interaction machine sends a reply to a message sent in by
    the user.

    :param InteractionMachine im:
        the interaction machine emitting the event.
    :param string content:
        the content of the reply
    :param bool continue_session:
        ``true`` if the reply did not end the session, ``false`` if the reply
        ended the session.

    The event type is ``reply``.
    */

    IMEvent.call(self, 'reply', im);
    self.content = content;
    self.continue_session = continue_session;
});


var SessionNewEvent = IMEvent.extend(function(self, im) {
    /**class:SessionNewEvent(im)

    Emitted when a new user session starts.

    :param InteractionMachine im:
        the interaction machine emitting the event.

    The event type is ``session:new``.
    */
    IMEvent.call(self, 'session:new', im);
});


var SessionCloseEvent = IMEvent.extend(function(self, im, user_terminated) {
    /**class:SessionCloseEvent(im, user_terminated)

    Emitted when a user session ends.

    :param InteractionMachine im:
        the interaction machine emitting the event.
    :param boolean user_terminated:
        true if the session was terminated by the user (including
        when the user session times out) and false if the session
        was closed explicitly by the sandbox application.

    The event type is ``session:close``.
    */

    IMEvent.call(self, 'session:close', im);
    self.user_terminated = user_terminated;
});


var SessionResumeEvent = IMEvent.extend(function(self, im) {
    /**class:SessionResumeEvent(im)

    Emitted when a new user message arrives for an existing user session.

    :param InteractionMachine im:
        the interaction machine emitting the event.

    The event type is ``session:resume``.
    */

    IMEvent.call(self, 'session:resume', im);
});


var IMErrorEvent = IMEvent.extend(function(self, im, error) {
    /**class:IMErrorEvent(im)

    Emitted when an error occurs during a run of the im.

    :param InteractionMachine im:
        the interaction machine emitting the event.
    :param InteractionMachine error:
        the error that occured.

    The event type is ``im:error``.
    */

    IMEvent.call(self, 'im:error', im);
    self.error = error;
});


var IMShutdownEvent = IMEvent.extend(function(self, im) {
    /**class:IMShutdownEvent(im)

    Occurs when the im is about to shutdown.

    :param InteractionMachine im:
        the interaction machine emitting the event.

    The event type is ``im:shutdown``.
    */

    IMEvent.call(self, 'im:shutdown', im);
});


var InteractionMachine = Eventable.extend(function(self, api, app) {
    /**class:InteractionMachine(api, app)

    :param SandboxAPI api:
        a sandbox API providing access to external resources and
        inbound messages.
    :param App app:
        a collection of states defining an application.

    A controller that handles inbound messages and fires events and
    handles state transitions in response to those messages. In addition, it
    serves as a bridge between a :class:`App` (i.e. set of states
    defining an application) and resources provided by the sandbox API.
    */
    Eventable.call(self);

    /**attribute:InteractionMachine.api
    A reference to the sandbox API.
    */
    self.api = api;

    /**attribute:InteractionMachine.app
    A reference to the :class:`App`.
    */
    self.app = app;

    /**attribute:InteractionMachine.msg
    The message command currently being processed. Available when
    setup is complete (see :meth:`InteractionMachine.setup`).
    */
    self.msg = null;

    /**attribute:InteractionMachine.user
    A :class:`User` instance for the current user. Available when
    setup is complete (see :meth:`InteractionMachine.setup`).
    */
    self.user = new User(self);

    /**attribute:InteractionMachine.state
    The current :class:`State` object. Updated whenever a new state is
    entered via a call to :meth:`InteractionMachine.switch_state`, 
    */
    self.state = null;

    /**attribute:InteractionMachine.next_state
    The next state that the user should move to once the user's input has
    been processed.
    */
    self.next_state = new StateData();

    /**attribute:InteractionMachine.log
    A :class:`Logger` instance for logging message in the sandbox.
    */
    self.log = new Logger(self);

    /**attribute:InteractionMachine.sandbox_config
    A :class:`SandboxConfig` instance for accessing the sandbox's config data.
    Available when setup is complete (see :meth:`InteractionMachine.setup`).
    */
    self.sandbox_config = new SandboxConfig(self);

    /**attribute:InteractionMachine.config
    A :class:`IMConfig` instance for the IM's config data. Available when
    setup is complete (see :meth:`InteractionMachine.setup`).
    */
    self.config = new IMConfig(self);

    /**attribute:InteractionMachine.metrics
    A default :class:`MetricStore` instance for emitting metrics. Available when
    setup is complete (see :meth:`InteractionMachine.setup`)
    */
    self.metrics = new MetricStore(self);
    
    /**attribute:InteractionMachine.contacts
    A default :class:`ContactStore` instance for managing contacts.
    Available when setup is complete (see :meth:`InteractionMachine.setup`)
    */
    self.contacts = new ContactStore(self);

    /**attribute:InteractionMachine.groups
    A default :class:`GroupStore` instance for managing groups.
    Available when setup is complete (see :meth:`InteractionMachine.setup`)
    */
    self.groups = new GroupStore(self);

    /**attribute:InteractionMachine.outbound
    A :class:`OutboundHelper` for sending out messages.
    Available when setup is complete (see :meth:`InteractionMachine.setup`)
    */
    self.outbound = new OutboundHelper(self);

    self.attach = function() {
        /**:InteractionMachine.attach()

        Attaches the im to the given api and app. The sandbox API's event
        handlers are set to emit the respective events on the interaction
        machine, then terminate the sandbox once their listeners are done.
        */
        var done = self.done;
        var err = self.err;

        self.api.on_unknown_command = function(cmd) {
            var e = new UnknownCommandEvent(self, cmd);
            self.emit(e).done(done, err);
        };

        self.api.on_inbound_event = function(cmd) {
            var e = new InboundEventEvent(self, cmd);
            self.emit(e).done(done, err);
        };

        self.api.on_inbound_message = function(cmd) {
            var e = new InboundMessageEvent(self, cmd);
            self.emit(e).done(done, err);
        };

        self.app.attach_im(self);
    };

    self.setup = function(msg, opts) {
        /**:InteractionMachine.setup(msg[, opts])
        Sets up the interaction machine using the given message.

        :param object msg:
            the received message to be used to set up the interaction machine.
        :param boolean opts.reset:
            whether to reset the user's data, or load them from the kv store

        The IM sets up its attributes in the following order:
            * sanbox config
            * im config
            * metric store
            * user
            * app

        Finally, the user's ``creation_event`` is emitted, then a
        :class:`SetupEvent` is emitted for the interaction machine. A
        promise is returned, which will be fulfilled once all event
        listeners are done.
        */
        self.msg = msg;
        opts = _.defaults(opts || {}, {reset: false});

        return Q()
            .then(function() {
                return self.sandbox_config.setup();
            })
            .then(function() {
                return self.config.do.setup();
            })
            .then(function() {
                return self.contacts.setup({
                    delivery_class: self.config.delivery_class
                });
            })
            .then(function() {
                return self.groups.setup();
            })
            .then(function() {
                return self.outbound.setup({
                    endpoints: self.config.endpoints,
                    delivery_class: self.config.delivery_class
                });
            })
            .then(function() {
                return self.metrics.setup({
                    store_name: self.config.metric_store
                             || self.config.name
                });
            })
            .then(function() {
                var user_opts = {
                    lang: self.config.default_lang,
                    store_name: self.config.user_store
                             || self.config.name
                };

                return opts.reset
                    ? self.user.reset(msg.from_addr, user_opts)
                    : self.user.load_or_create(msg.from_addr, user_opts);
            })
            .then(function() {
                self.log("Loaded user: " + JSON.stringify(self.user));
                return self.app.setup();
            })
            .then(function() {
                return self.user.emit.creation_event();
            })
            .then(function() {
                return self.emit.setup();
            });
    };

    self.teardown = function() {
        return Q()
          .then(function() {
              return self.app.teardown();
          })
          .then(function() {
              self.teardown_listeners();
              return self.emit.teardown();
          });
    };

    self.create_state = function(state) {
        /**:InteractionMachine.create_state(state)

        Creates a new state using the given :class:`StateData` or state name.

        :type state:
            object, string, or StateData
        :param state:
            The state to create
        */
        state = new StateData(state);

        return self.app.states.create(state.name, state.creator_opts)
            .then(function(new_state) {
                return new_state
                    .setup(self, state.metadata)
                    .thenResolve(new_state);
            });
    };

    self.set_state = function(state) {
        /**:InteractionMachine.set_state(state)

        Sets the given :class:`State` as the :class:`InteractionMachine`\'s
        current state.

        :param State state:
            The state set as the current state
        */
        self.state = state;
        self.user.state.reset(state);
    };

    self.create_and_set_state = function(state) {
        /**:InteractionMachine.create_and_set_state(state)

        Creates new state using the given :class:`StateData` or state name,
        then sets it as the :class:`InteractionMachine`\'s current state.

        :type state:
            object, string, or StateData
        :param state:
            The state to create and set
        */
        return self.create_state(state)
            .then(function(state) {
                self.set_state(state);
                return state;
            });
    };

    self.resume_state = function(state) {
        /**:InteractionMachine.resume(state)

        Creates the given state, sets it as the current state, then emits a
        :class:StateResumeEvent` (on :class:InteractionMachine, then the new
        state).
        
        If the created state has a different name to the requested state, a
        :class:StateEnterEvent` is emitted instead. This happens, for example,
        if the requested state does not exist (see :meth:`AppStates.create`).

        :type state:
            object, string, or StateData
        :param state:
            the state to resume
        */
        state = new StateData(state);

        return self.create_and_set_state(state)
            .then(function(new_state) {
                return new_state.name !== state.name
                    ? self.emit.state.enter(new_state)
                    : self.emit.state.resume(new_state);
            });
    };

    self.enter_state = function(state) {
        /**:InteractionMachine.enter_state(state)

        Creates the given state, sets it as the current state, then emits a
        :class:StateEnterEvent` (on :class:InteractionMachine, then the new
        state).

        :type state:
            object, string, or StateData
        :param state:
            the state to enter
        */
        return self.create_and_set_state(state)
            .then(function(state) {
                return self.emit.state.enter(state);
            });
    };

    self.exit_state = function() {
        /**:InteractionMachine.exit_state()

        Emits a :class:StateExitEvent` (on :class:InteractionMachine, then the
        state), then resets the interaction machine's state to ``null``. If the
        interaction machine is not on a state, this method is a no-op.
        */
        if (!self.state) return Q();
        return self.emit.state.exit(self.state)
            .then(function() {
                self.set_state(null);
            });
    };

    self.switch_state = function(dest) {
        /**:InteractionMachine.switch_state(dest)

        Switches the IM from its current state to the given destination state.
        Returns a promise fulfilled once the switch has completed.

        :type dest:
            object, string, or StateData
        :param dest:
            the destination state's name or state data

        The following steps are taken:
            * The current state is exited
              (see :meth:`InteractionMachine.exit_state`)
            * The destination state is enter
              (see :meth:`InteractionMachine.enter_state`)
        */
        var p = Q();
        dest = new StateData(dest);
        if (!dest.exists() || dest.is(self.state)) { return p; }

        return p
            .then(function() {
                return self.exit_state();
            })
            .then(function() {
                return self.enter_state(dest);
            });
    };

    self.fetch_translation = function(lang) {
        /**:InteractionMachine.fetch_translation(lang)

        Retrieve a :class:`Translator` instance corresponding to the
        translations for the given language. Returns a promise that will be
        fulfilled with the retrieved translator.

        :param string lang:
            two letter language code (e.g. ``sw``, ``en``).

        Translations are retrieved from the sandbox configuration resource
        by looking up keys named ``translation.<language-code>``.
        */
        return self.sandbox_config
            .get("translation." + lang, {json: true})
            .then(function(domain_data) {
                var jed_data = {};

                if (domain_data) {
                    jed_data.domain = "messages";
                    jed_data.locale_data = {messages: domain_data};
                }

                return new Translator(jed_data);
            });
    };

    self.err = function(e) {
        /**InteractionMachine.err()
        Invoked when an error is thrown during a run of the IM. Logs the thrown
        error, then terminates the sandbox.
        */
        return self
            .emit(new IMErrorEvent(self, e))
            .then(function() {
                return self.log.error(e.message);
            })
            .then(function() {
                return self.api.done();
            });
    };

    self.done = function() {
        /**:InteractionMachine.done()
        Saves the user, then terminates the sandbox instance.
        */
        return self
            .emit(new IMShutdownEvent(self))
            .then(function() {
                return self.user.save();
            })
            .then(function() {
                return self.teardown();
            })
            .then(function() {
                return self.api.done();
            });
    };

    self.api_request = function(cmd_name, cmd) {
        /**:InteractionMachine.api_request(cmd_name, cmd)

        Raw request to the sandbox API.

        :param string cmd_name:
            name of the API request to make.
        :param object cmd:
            API request data.

        Returns a promise fulfilled with the response to the API request, or
        rejected with a :class:`ApiError` if a failure response was given.
        */
        var d = new Q.defer();
        self.api.request(cmd_name, cmd, function(reply) {
            if (reply.success) {
                d.resolve(reply);
            } else {
                d.reject(new ApiError(reply));
            }
        });
        return d.promise;
    };

    self.reply = function(msg, opts) {
        /**:InteractionMachine.reply(msg)

        Send a response from the current state to the user.

        Returns a promise which is fulfilled once the response has been sent.
        */
        opts = opts || {};

        return Q()
            .then(function() {
                return self.switch_state(self.next_state);
            })
            .then(function() {
                return self.state.continue_session();
            })
            .then(function(continue_session) {
                opts.continue_session = continue_session;
                self.user.in_session = continue_session;

                if (continue_session) { return; }
                var e = new SessionCloseEvent(self, false);
                return self.emit(e);
            })
            .then(function() {
                return self.state.send_reply();
            })
            .then(function(send_reply) {
                if (!send_reply) { return; }
                return self.reply.send(msg, opts);
            });
    };

    self.reply.send = function(msg, opts) {
        opts = _.defaults(opts || {}, {translate: true});

        return Q()
            .then(function() {
                return self.state.show();
            })
            .then(function(content) {
                return self.api_request("outbound.reply_to", {
                    content: content,
                    in_reply_to: msg.message_id,
                    continue_session: opts.continue_session
                })
                .then(function() {
                    return self.emit(new ReplyEvent(
                        self, content, opts.continue_session));
                });
            });
    };

    self.handle_message = function(msg) {
        /**:InteractionMachine.handle_message(msg)

        Delegates to its subordinate message handlers to handle an inbound
        message based on the message's session event type. The fallback message
        handler is defined by
        :func:`InteractionMachine.handle_message.fallback`, which by default
        is an alias for :func:`InteractionMachine.handle_message.resume`.

        If the user is not currently in a session (which happens for new users
        and users that have reached an :class:`EndState` in a previous session),
        and the message does not have a ``session_event`` (as is the case for
        session-less messages such as smses or tweets), we assume the user is
        starting a new session.

        :param object msg: the received inbound message.
         **/
        var session_event = msg.session_event;

        if (!self.user.in_session) {
            session_event = session_event || 'new';
            self.user.in_session = true;
        }

        var handler = self.handle_message[session_event];
        handler = handler || self.handle_message.fallback;
        return handler.call(self, msg);
    };

    self.handle_message.close = function(msg) {
        /**:InteractionMachine.handle_message.close(msg)

        Invoked when an inbound message is received with a ``close`` session
        event type. Emits a :class:`SessionCloseEvent` on the interaction
        machine and waits for its listeners to complete their work.

        :param object msg: the received inbound message.
        */
        return self.emit(new SessionCloseEvent(self, true));
    };

    self.handle_message.new = function(msg) {
        /**:InteractionMachine.handle_message.new(msg)

        Invoked when an inbound message is received with a ``new`` session
        event type.

        :param object msg: the received inbound message.

        Does roughly the following:

            * Emits a :class:`SessionNewEvent` on the interaction machine and
              waits for its listeners to complete their work
            * Sends a reply from the current state.
        */
        var e = new SessionNewEvent(self);
        return self
            .emit(e)
            .then(function () {
                return self.reply(msg);
            });
    };

    self.handle_message.resume = function(msg) {
        /**:InteractionMachine.handle_message.resume(msg)

        Invoked when an inbound message is received with a ``resume`` session
        event type.

        :param object msg: the received inbound message.

        Does roughly the following:

            * Emits a :class:`SessionResumeEvent` on the interaction machine
              and waits for its listeners to complete their work
            * If the message contains usable content, give the content to the
              state (which fires a :class:`StateInputEvent`).
            * Send a reply from the current state.
        */
        var p = self.emit(new SessionResumeEvent(self));

        if (msg.content) {
            p = p.then(function() {
                return self.state.input(msg.content);
            });
        }

        return p.then(function() {
            return self.reply(msg);
        });
    };

    self.handle_message.fallback = self.handle_message.resume;

    self.emit.state = {};

    self.emit.state.event = function(e) {
        return self
            .emit(e)
            .then(function() {
                return e.state.emit(e);
            });
    };

    self.emit.state.exit = function(state) {
        return self.emit.state.event(new StateExitEvent(state));
    };

    self.emit.state.enter = function(state) {
        return self.emit.state.event(new StateEnterEvent(state));
    };

    self.emit.state.resume = function(state) {
        return self.emit.state.event(new StateResumeEvent(state));
    };

    self.on('unknown_command', function(event) {
        /**:InteractionMachine.on "unknown_command" (event)

        Invoked by a :class:`UnknownCommandEvent` event when a command without
        a handler is received (see :class:`UnknownCommandEvent`). Logs an
        error.

        :param UnknownCommandEvent event: the fired event.
        */
        return self.log.error(
            "Received unknown command: " + JSON.stringify(event.cmd));
    });

    self.on('inbound_message', function(event) {
        /**:InteractionMachine.on "inbound_message" (event)

        Invoked an inbound user message, triggering state transitions and events
        as necessary.

        :param InboundMessageEvent event: the fired event.

        The steps performed by this method are roughly:
            * Set up the IM (see :meth:`InteractionMachine.setup`)
            * If the user is currently in a state (from a previous IM run),
              switch to this state.
            * Otherwise, this is a new user, so switch to the IM's configured
              start state
            * Handle the message based on its session event type (see
              :meth:`InteractionMachine.handle_message`).
        */
        var msg = event.cmd.msg;
        self.log("Received inbound message: " + msg.content);

        var reset = false;
        if (msg.content == "!reset") {
            reset = true;
            msg.content = "";
        }

        return self
            .setup(msg, {reset: reset})
            .then(function() {
                if (self.user.state.exists()) {
                    return self.resume_state(self.user.state);
                } else {
                    return self.enter_state(self.app.start_state_name);
                }
            })
            .then(function() {
                self.log("Switched to state: " + self.state.name);
                return self.handle_message(msg);
            });
    });

    self.attach();
});


function interact(api, f) {
    /**function:interact(api, f)

    If ``api`` is defined, create an :class:`InteractionMachine` with
    the :class:`App` returned by ``f``. Otherwise do nothing.

    If ``f`` is an :class:`App` subclass, ``new f()`` is used to construct
    the application instance instead.

    :param SandboxAPI api:
        a sandbox API providing access to external resources and
        inbound messages
    :param function f:
        a function that returns an :class:`App` instance or an
        :class:`App` class.

    Returns the :class:`InteractionMachine` created or ``null`` if no
    :class:`InteractionMachine` was created.

    Usually the return value is ignored since creating an
    :class:`InteractionMachine` attachs it to the ``api``.
    */
    if (typeof api != 'undefined') {
        var app = f.prototype instanceof App ? new f() : f();
        return new InteractionMachine(api, app);
    }
    return null;
}


this.InteractionMachine = InteractionMachine;
this.interact = interact;

this.IMEvent = IMEvent;
this.IMErrorEvent = IMErrorEvent;
this.IMShutdownEvent = IMShutdownEvent;
this.InboundMessageEvent = InboundMessageEvent;
this.InboundEventEvent = InboundEventEvent;
this.UnknownCommandEvent = UnknownCommandEvent;
this.ReplyEvent = ReplyEvent;
this.SessionNewEvent = SessionNewEvent;
this.SessionResumeEvent = SessionResumeEvent;
this.SessionCloseEvent = SessionCloseEvent;
