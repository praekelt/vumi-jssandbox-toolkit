var assert = require("assert");
var vumigo = require("../../../lib");


var DummyIm = vumigo.test_utils.DummyIm;
var ChoiceState = vumigo.states.ChoiceState;
var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
var Choice = vumigo.states.Choice;
var success = vumigo.promise.success;


describe("ChoiceState", function () {
    var im;

    function make_state(options) {
        var state = new ChoiceState(
          "color-state",
          function(choice, done) {
              done({
                  red: 'red-state',
                  blue: 'blue-state',
              }[choice.value]);
          },
          "What is your favourite colour?", [
              new Choice('red', 'Red'),
              new Choice('blue', 'Blue')
          ],
          null,
          null,
          options || {});

        state.setup_state(im);
        return state;
    }

    beforeEach(function () {
        im = new DummyIm();
    });

    describe("if the 'accept_labels' option is not set", function() {
        it("should accept a number-based answers", function (done) {
            var state = make_state();

            state.input_event("1", function() {
                assert.equal(im.current_state, 'red-state');
                done();
            });
        });

        it("should not accept label-based answers", function(done) {
            var state = make_state();

            state.input_event("Red", function() {
                assert.equal(im.current_state, null);
                done();
            });
        });
    });

    describe("if the 'accept_labels' option is set", function() {
        it("should accept label-based answers", function(done) {
            var state = make_state({accept_labels: true});

            state.input_event("Red", function() {
                assert.equal(im.current_state, 'red-state');
                done();
            });
        });

        it("should be case insensitive with label-based answers",
        function(done) {
            var state = make_state({accept_labels: true});

            state.input_event("reD", function() {
                assert.equal(im.current_state, 'red-state');
                done();
            });
        });

        it("should accept number-based answers", function(done) {
            var state = make_state({accept_labels: true});

            state.input_event("1", function() {
                assert.equal(im.current_state, 'red-state');
                done();
            });
        });
    });
});

describe("PaginatedChoiceState", function () {
    var im,
        choices;

    function make_state(options) {
        var state = new PaginatedChoiceState(
          "color-state",
          function(choice, done) {
              done({
                  long: 'long-state',
                  short: 'short-state',
              }[choice.value]);
          },
          "What is your favourite colour?",
          choices,
          null,
          null,
          options || {});

        state.setup_state(im);
        return state;
    }

    function check_choices(choices, new_choices, new_labels) {
        assert.deepEqual(
            choices.map(function(c) { return c.value; }),
            new_choices.map(function(c) { return c.value; })
        );
        assert.deepEqual(
            new_choices.map(function(c) { return c.label; }),
            new_labels
        );
    }

    beforeEach(function () {
        im = new DummyIm();
        choices = [
            new Choice('long', 'Long item name'),
            new Choice('short', 'Short')
        ];
    });

    describe("shorten_choices", function() {
        it("should shorten choices if needed", function() {
            var state = make_state({characters_per_page: 25});
            var new_choices = state.shorten_choices("Choices:", choices);
            check_choices(choices, new_choices, ["L...", "Short"]);
        });

        it("should not shorten choices if not needed", function() {
            var state = make_state({characters_per_page: 100});
            var new_choices = state.shorten_choices("Choices:", choices);
            check_choices(choices, new_choices, ["Long item name", "Short"]);
        });

        it("should return all the choices if the text is already too long", function() {
            var state = make_state({characters_per_page: 4});
            var new_choices = state.shorten_choices("12345", choices);
            check_choices(choices, new_choices, ["Long item name", "Short"]);
        });
    });
});