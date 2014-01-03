// state.js
//  - Base state class.


function StateError(msg) {
    this.name = "StateError";
    this.message = msg;
}
StateError.prototype = new Error();
StateError.prototype.constructor = StateError;


function State(name, handlers) {
    /**class:State(name, [handlers])

    Base class for application states.

    :param string name: name of the state.
    :param object handlers:
        Mapping of handler names to handler functions for state events.
        Possible handler names are ``setup_state``, ``on_enter`` and
        ``on_exit``. Handler functions have the form ``func(state)``.
    */

    var self = this;
    self.name = name;
    self.handlers = handlers || {};

    self.setup_state = function(im) {
        // called before any other methods on the state
        // are called to allow the state to set itself up.
        //
        // - im: InteractionMachine using the state
        //
        // May return a promise instead of returning immediately
        self.im = im;
        return self.call_possible_handler(self.handlers.setup_state);
    };

    self.save_response = function(response) {
        // called by sub-classes to store accepted user responses
        // on the user object.
        //
        // - response: value to store as answer
        self.im.set_user_answer(self.name, response);
    };

    self.input_event = function(content, done) {
        // called with content from the user
        //
        // - content: string containing text from the user
        // - done: callback for when the input handling is done
        done();
    };

    self.new_session_event = function(done) {
        // called when a new session starts instead of input_event
        //
        // - done: callback for when the input handling is done
        done();
    };

    self.on_enter = function() {
        // called when the state is entered by a user (from
        // a different state).
        //
        // May return a promise instead of returning immediately
        return self.call_possible_handler(self.handlers.on_enter);
    };

    self.on_exit = function() {
        // called when the state is exited by the user (to
        // a different state)
        //
        // May return a promise instead of returning immediately
        return self.call_possible_handler(self.handlers.on_exit);
    };

    self.display = function() {
        return "State: [" + self.name + "]";
    };

    self.translate = function(i18n) {
        // translate any text that was not translated previously
        // (this is a helper to make writing static states upfront
        // easier).
    };

    self.continue_session = function() {
        return true;
    };

    self.send_reply = function() {
        return true;
    };

    self.call_possible_function = function(f, that, args, done) {
        if (typeof f != 'function') {
            done(f);
        }
        else if (f.length == args.length) {
            done(f.apply(that, args));
        }
        else if (f.length == args.length + 1) {
            args[args.length] = done;
            f.apply(that, args);
        }
        else {
            throw StateError("Incorrect numnber of args passed to" +
                             " function called via call_possible_function");
        }
    };

    self.call_possible_handler = function(f) {
        if (typeof f == 'undefined') {
            return null;
        }
        else {
            return f.call(self);
        }
    };
}


// exports

this.State = State;
this.StateError = StateError;