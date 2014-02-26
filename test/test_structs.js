var _ = require('lodash');
var assert = require('assert');

var vumigo = require('../lib');
var structs = vumigo.structs;
var Model = structs.Model;


describe("models", function() {
    describe("Model", function() {
        describe(".clear", function() {
            it("should clear all of the model's attributes", function() {
                var model = new Model({
                    foo: 'bar',
                    baz: 'qux'
                });

                assert.deepEqual(model, {
                    foo: 'bar',
                    baz: 'qux'
                });

                model.clear();

                assert.deepEqual(model, {});
            });
        });

        describe(".reset", function() {
            it("should validate the model", function() {
                var model = new Model();

                var validated = false;
                model.cls.validate = function() {
                    validated = true;
                };

                model.reset();
                assert(validated);
            });

            it("should reset the model's attributes", function() {
                var model = new Model({
                    foo: 'bar',
                    baz: 'qux'
                });

                assert.deepEqual(model, {
                    foo: 'bar',
                    baz: 'qux'
                });

                model.reset({
                    foo: 'lorem',
                    lerp: 'larp'
                });

                assert.deepEqual(model, {
                    foo: 'lorem',
                    lerp: 'larp'
                });
            });

            it("should apply the model's default attributes", function() {
                var model = new Model();

                model.cls.defaults = {
                    'foo': 'lerp',
                    'baz': 'larp'
                };

                model.reset({foo: 'bar'});
                assert.deepEqual(model, {
                    foo: 'bar',
                    baz: 'larp'
                });
            });
        });

        describe(".serialize", function() {
            it("should validate the model", function() {
                var model = new Model();

                var validated = false;
                model.cls.validate = function() {
                    validated = true;
                };

                model.serialize();
                assert(validated);
            });

            it("should return a deep copy of its attributes", function() {
                var model = new Model({
                    foo: 'bar',
                    baz: 'qux'
                });

                var data = model.serialize();
                assert.deepEqual(data, {
                    foo: 'bar',
                    baz: 'qux'
                });

                data.foo = 'spam';
                assert.equal(model.foo, 'bar');
            });
        });

        it("should allow only model attributes to be enumerable", function() {
            var model = new Model({foo: 'bar'});
            model.cls.spam = 'ham';
            assert.deepEqual(_.keys(model), ['foo']);
        });

        it("should allow model class properties to be directly accessible",
        function() {
            var model = new Model();
            model.cls.spam = 'ham';
            assert.equal(model.spam, 'ham');
        });

        describe(".extend", function() {
            it("should set up the child's prototype chain", function() {
                var Parent = Model.extend(function() {});
                var Child = Parent.extend(function() {});

                var p = new Parent();
                var c = new Child();

                assert(p instanceof Model);
                assert(p instanceof Parent);

                assert(c instanceof Model);
                assert(c instanceof Parent);
                assert(c instanceof Child);
            });

            it("should set the parent's static methods on the child",
            function() {
                var Parent = Model.extend(function() {});
                assert.equal(Parent.extend, Model.extend);
                Parent.foo = 'bar';

                var Child = Parent.extend(function() {});
                assert.equal(Child.extend, Parent.extend);
                assert.equal(Child.foo, Parent.foo);
            });

            describe("the constructor's context", function() {
                it("should be the first arg of the constructor", function() {
                    var Thing = Model.extend(function(self) {
                        assert.strictEqual(self, this);
                    });

                    new Thing();
                });
            });
        });
    });
});
