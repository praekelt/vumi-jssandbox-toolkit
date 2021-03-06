var Q = require('q');
var _ = require('lodash');

var utils = require('../utils');
var BaseError = utils.BaseError;

var events = require('../events');
var Event = events.Event;
var Eventable = events.Eventable;

var translate = require('../translate');
var LazyText = translate.LazyText;


var StateError = BaseError.extend(function(self, state, message) {
    /**class:StateError(state, message)
    Occurs when interacting or manipulating a state causes an error.

    :param State state: the state that caused the error.
    :param string message: the error message.
    */
    self.name = 'StateError';
    self.state = state;
    self.message = message;
});


var StateInvalidError = StateError.extend(function(self, state, response, opts) {
    /**class:StateInvalidError(state, response[, opts])
    Occurs when a state receives invalid input. Raised either by a failed
    validation check or by explicitly calling :meth:`State.invalidate`.

    :param State state: the state that caused the error.
    :type response: string or LazyText
    :param response: the response to send back to the user.
    :param string opts.reason: the reason for the error.
    :param string opts.input: the user input that caused the error, if relevant
    */
    StateError.call(self, state);
    self.name = 'StateInvalidError';
    self.state = state;
    self.response = response;

    opts = _.defaults(opts || {}, {
        input: null,
        reason: null
    });
    self.input = opts.input;
    self.reason = opts.reason;

    self.translate = function(i18n) {
        /**:StateInvalidError.translate(i18n)
        Translate the error response.

        :param Translator i18n:
            the translation function to be used for translating the text.
        */
        self.response = i18n(self.response);
    };

    function message() {
        var parts = [
            self.reason || '',
            "(state: " + self.state.name + ")",
            "(response: " + self.response + ")"];

        if (utils.exists(self.input)) {
            parts.push("(input: " + self.input + ")");
        }

        return parts.join(' ').trim();
    }
    Object.defineProperty(self, 'message', {get: message});
});


var StateEvent = Event.extend(function(self, name, state) {
    /**class:StateEvent(name, state, data)
    An event relating to a state.

    :param string name: the event type's name.
    :param State state: the state associated to the event.
    */
    Event.call(self, name);
    self.state = state;
});


var StateInvalidEvent = StateEvent.extend(function(self, state, error) {
    /**class:StateEvent(name, state, error)
    Emitted when a state becomes invalid.

    :param State state: the state associated to the event.
    :param StateInvalidError error: the validation error that occured.
    */
   StateEvent.call(self, 'state:invalid', state);
   self.error = error;
});


var StateInputEvent = StateEvent.extend(function(self, state, content) {
    /**class:StateInputEvent(content)
    Emitted when the user has given input to the state.

    :param State state: the state that the input was given to.
    :param string content: text from the user.

    The event type is ``state:input``.
    */
   StateEvent.call(self, 'state:input', state);
   self.content = content;
});


var StateEnterEvent = StateEvent.extend(function(self, state) {
    /**class:StateEnterEvent()
    Emitted when the state is entered by a user.
    
    This happens when the state is
    switched to from another state, or when the state is created if this is the
    start of a new session).
    
    :param State state: the state being entered.

    The event type is ``state:enter``.
    */
   StateEvent.call(self, 'state:enter', state);
});


var StateResumeEvent = StateEvent.extend(function(self, state) {
    /**class:StateResumeEvent()
    Emitted when the state is resumed.

    When the user enters input, the new sandbox run is started, causing the
    state to be re-created (or resumed) to process the user's input. This means
    that when this event is emitted, the state has already been entered (see
    :class:`StateEnterEvent`) and its content has been shown to the user in a
    previous sandbox run (provided the session didn't timeout when the send was
    attempted).

    :param State state: the state being resumed.

    The event type is ``state:resume``.
    */
   StateEvent.call(self, 'state:resume', state);
});


var StateExitEvent = StateEvent.extend(function(self, state) {
    /**class:StateEnterEvent()
    Emitted when the state is exited by the user. This happens immediately
    before the interaction machine switches to a different state (see
    :class:`StateEnterEvent`).

    :param State state: the state being exited.

    The event type is ``state:exit``.
    */
   StateEvent.call(self, 'state:exit', state);
});

var StateShowEvent = StateEvent.extend(function(self, state, content) {
    /**class:StateShowEvent()
    Emitted when a state's is shown to a user, immediately after
    :meth:`State.display` has completed.

    :param State state: the state being shown.
    :param string content: the content being shown.

    The event type is ``state:show``.
    */
   StateEvent.call(self, 'state:show', state);
   self.content = content;
});


var State = Eventable.extend(function(self, name, opts) {
    /**class:State(name, opts)
    Base class for states in the interaction machine. States can be thought of
    as a single screen in a set of interactions with the user.

    :param string name:
        name used to identify and refer to the state
    :param object opts.metadata:
        data about the state relevant to the interaction machine's current
        user. Optional.
    :param boolean opts.send_reply:
        whether or not a reply should be sent to the user's message. Default is
        `true`. May also be a function, which may return its result via a
        promise.
    :param boolean opts.continue_session:
        whether or not this is the last state in a session. Default is ``true``.
        May also be a function, which may return its result via a promise.
    :param object opts.helper_metadata:
        additional helper metadata to set on the reply sent to the user.
        Primarily useful for setting voice metadata for messages destined to
        be sent as voice calls. Default is `null`. May also be a function,
        which may return its result via a promise.
    :param function opts.check:
        a function ``func(input)`` for validating a user's response, where
        ``input`` is the user's input. If a string or :class:`LazyText` is
        returned, the text will be taken as the error response to send back
        to the user. If a :class:`StateInvalidError` is returned, its
        ``response`` property will be taken as the error response to send back
        to the user. Any other value returned will be taken as a non-error. The
        result may be returned via a promise. See :meth:`State.validate`.
    :param object opts.events:
        Optional event name-listener mappings to bind. For example:

        .. code-block:: javascript

            {
                'state:invalid': function(e) {
                    console.log(e);
                }
            }
     */
    Eventable.call(self);

    opts = _.defaults(opts || {}, {
        send_reply: true,
        continue_session: true,
        helper_metadata: null,
        check: utils.functor(),
        events: {}
    });

    self.im = null;
    self.error = null;
    self.name = name;
    self.send_reply = utils.functor(opts.send_reply);
    self.continue_session = utils.functor(opts.continue_session);
    self.helper_metadata = utils.functor(opts.helper_metadata);
    self.check = opts.check;
    self.events = opts.events;

    // internal reference to the creator opts used to create the state
    self._creator_opts = null;

    self.setup = function(im, metadata) {
        /**:State.setup(im)
        Called before any other methods on the state are called to allow the
        state to set itself up.

        :param InteractionMachine im: interaction machine using the state.
        */
        self.im = im;
        self.metadata = metadata || {};
        self.on(self.events);

        return Q(self.init()).then(function() {
            return self.emit.setup();
        });
    };

    self.init = function() {
        /**:State.init()
        Invoked just after setup has completed, and just before 'setup' event
        is fired to provide subclasses with a setup hook. May return a promise.
        */
    };

    self.input = function(content) {
        /**:State.input()
        Accepts input, invokes :meth:`State.translate.before_input`, then
        emits a :class:`StateInputEvent`` to allow input to be processed.
        */
        var p = Q(self.translators.before_input(self.im.user.i18n));
        return p.then(function() {
            return self.emit.input(content);
        });
    };

    self.save_response = function(response) {
        /**:State.save_response(response)
        Called by sub-classes to store accepted user responses on the user
        object.

        :param string response: value to store as an answer.
        */
        self.im.user.set_answer(self.name, response);
    };

    self.set_next_state = function(next) {
        /**:State:set_next_state(name)

        Set the state that the user will visit after this state using the given
        state name.

        :param string name:
            The name of the next state
        */
        /**:State:set_next_state(fn[, arg1[, arg2[, ...]]])

        Use a function to set the state that the user will visit this state.
        
        :param function fn:
            a function that returns name of the next state or an options object
            with data about the next state. The value of ``this`` inside ``f``
            will be the calling state instance. May also return its result via
            a promise.
        :param arguments arg1, arg2, ...:
            arguments to pass to ``fn``
        */
        var args = Array.prototype.slice.call(arguments, 1);
        var p = Q(utils.maybe_call(next, self, args));
        return p.then(function(next) {
            if (typeof next != 'undefined' && next !== null) {
                return self.im.next_state.reset(next);
            }
        });
    };

    self.validate = function(input) {
        /**meth:State.validate(input)
        Validates the given ``input`` using the state's validation checker
        (``self.check``), setting the state's ``self.error`` object and 
        emitting a :class:`StateInvalidError` if validation fails.

        :type input: string or LazyText
        :param input:
            The input to be validated. May also be also be of a type supported
            by the relevant state type (for example, :class:`Choice` as an
            input for :class:`ChoiceState`).
        */
        return Q(self.check(input)).then(function(result) {
            var error;

            if (typeof result === "undefined" || result === null) {
                return;
            }

            if (result instanceof StateInvalidError) {
                error = result;
            }
            else if (typeof result == 'string' ||
                     result instanceof LazyText) {
                error = new StateInvalidError(self, result, {
                    reason: 'Bad user input',
                    input: input
                });
            }
            else {
                throw new StateError(self, [
                    ".check() may only return null or undefined (to indicate",
                    " success), or string, LazyText or StateInvalidError",
                    " objects (to indicate errors)",
                ].join(""));
            }

            return self.invalidate(error);
        });
    };

    self.invalidate = function(error) {
        /**:State.invalidate(response)
        Invalidates the user's state, sending the given response to the user.
        Sets the state's ``self.error`` object to an appropriate error and
        emits a  :class:`StateInvalidEvent`.

        :type response: string or :class:`LazyText`
        :param response:
            the response to send back to the user
        */
        /**:State.invalidate(error)
        Invalidates the user's state using an error. Sets the state's
        ``self.error`` object to an appropriate error and emits a
        :class:StateInvalidEvent``.

        :param StateInvalidError error:
            the error to invalidate the user's state with.
        */
        if (typeof error == 'string' || error instanceof LazyText) {
            error = new StateInvalidError(self, error);
        }

        self.error = error;
        return self.emit(new StateInvalidEvent(self, error));
    };

    self.show = function() {
        /**:State.show()

        Translates the state using :meth:`State.translators.before_display`,
        then displays its text.
        */
        var p = Q(self.translators.before_display(self.im.user.i18n));

        return p
            .then(function() {
                return self.display();
            })
            .then(function(content) {
                return self
                    .emit(new StateShowEvent(self, content))
                    .thenResolve(content);
            });
    };

    self.display = function() {
        /**:State.display()
        The content to be displayed to the user. May return a promise.
        */
        return "State: [" + self.name + "]";
    };

    self.translate = function(i18n) {
        /**:State.translate(i18n)

        Translate's a state's text using the given translator.
        May return a promise.

        :param Translator i18n:
            the translation function to be used for translating the text.
        */
    };

    self.translators = {};

    self.translators.before_input = function(i18n) {
        /**:State.translators.before_input(i18n)

        Translate's a state's text using the given translator. Invoked before
        user input is processed. By default, just delegates to
        :meth:`State.translate`. May return a promise.

        :param Translator i18n:
            the translation function to be used for translating the text.
        */
        return self.translate(i18n);
    };

    self.translators.before_display = function(i18n) {
        /**:State.translators.before_display(i18n)
        Translate's a state's text using the given translator. Invoked before
        text is displayed to the user. By default, just delegates to
        :meth:`State.translate`. May return a promise.

        :param Translator i18n:
            the translation function to be used for translating the text.
        */
        return self.translate(i18n);
    };

    self.emit.input = function(content) {
        /**:State.emit.input(im)
        Shortcut for emitting an input event for the state (since this is done
        quite often). See :class:`StateInputEvent`.
        */
        return self.emit(new StateInputEvent(self, content));
    };

    self.serialize = function() {
        return {
            name: self.name,
            metadata: self.metadata
        };
    };

    self._record_creator_opts = function(opts) {
        // Internal method used in AppStates.create(). Only sets its creator opts
        // the first time it is called. Ensures we can recreate the state with the
        // same creator opts when the state is recreated next sandbox run. Needed
        // for cases where AppStates.create() is called inside a state creator. A
        // workaround needed to maintain backwards compatability (a better approach
        // would be to have AppStates.create() return both the new state and the
        // creator opts used to create it.
        if (self._creator_opts !== null) { return; }
        self._creator_opts = opts;
    };

    self.toJSON = self.serialize;
});


this.State = State;

this.StateError = StateError;
this.StateInvalidError = StateInvalidError;

this.StateEvent = StateEvent;
this.StateInputEvent = StateInputEvent;
this.StateExitEvent = StateExitEvent;
this.StateEnterEvent = StateEnterEvent;
this.StateResumeEvent = StateResumeEvent;
this.StateInvalidEvent = StateInvalidEvent;
