var assert = require("assert");
var vumigo = require("../../lib");


var FreeText = vumigo.states.FreeText;
var test_utils = vumigo.test_utils;


describe("Freetext", function () {
    var im;
    var state;

    beforeEach(function() {
        return test_utils.make_im().then(function(new_im) {
            im = new_im;

            state = new FreeText('state_1', {
                next: 'state_2',
                question: 'yes?',
                error: 'no!',
                check: function(content) {
                    return content == 'A lemon';
                }
            });

            im.app.states.add(state);
            return im.switch_state('state_1');
        });
    });

    describe("on state:input", function() {
        describe("if the user response is valid", function() {
            it("should set the user's current state to the next state",
            function() {
                assert.equal(im.user.state.name, 'state_1');

                return state.emit.input('A lemon').then(function() {
                    assert.equal(im.user.state.name, 'state_2');
                });
            });

            it("should save the user's response", function() {
                assert(typeof im.user.get_answer('state_1') == 'undefined');

                return state.emit.input('A lemon').then(function() {
                    assert.equal(im.user.get_answer('state_1'), 'A lemon');
                });
            });
        });

        describe("if the user response is invalid", function() {
            it("should not set the user's state", function() {
                assert.equal(im.user.state.name, 'state_1');

                return state.emit.input('Not a lemon').then(function() {
                    assert.equal(im.user.state.name, 'state_1');
                });
            });

            it("should not save the user's state", function() {
                assert(typeof im.user.get_answer('state_1') == 'undefined');

                return state.emit.input('Not a lemon').then(function() {
                    var answer = im.user.get_answer('state_1');
                    assert(typeof answer == 'undefined');
                });
            });

            it("should put the state in an error state", function() {
                assert(!state.in_error);

                return state.emit.input('Not a lemon').then(function() {
                    assert(state.in_error);
                });
            });
        });
    });

    describe(".translate", function() {
        it("should translate the question", function() {
            assert.equal(state.question_text, 'yes?');
            state.translate(im.user.i18n);
            assert.equal(state.question_text, 'ja?');
        });

        it("should translate the error text", function() {
            assert.equal(state.error_text, 'no!');
            state.translate(im.user.i18n);
            assert.equal(state.error_text, 'nee!');
        });
    });

    describe(".display", function() {
        describe("if the state is not in an error", function() {
            it("should display the given question text", function() {
                assert.equal(state.display(), 'yes?');
            });
        });

        describe("if the state is in an error", function() {
            it("should display the given error text", function() {
                state.in_error = true;
                assert.equal(state.display(), 'no!');
            });
        });
    });
});
