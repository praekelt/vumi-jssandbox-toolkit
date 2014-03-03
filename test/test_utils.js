var assert = require("assert");
var utils = require("../lib/utils");

describe("utils", function() {
    describe("functor", function() {
        describe("if the object is a function", function() {
            it("should simply return the object", function() {
                function f() {}
                assert.equal(utils.functor(f), f);
            });
        });

        describe("if the object is not a function", function() {
            it("should wrap the object in a function", function() {
                var obj = {};
                var f = utils.functor(obj);
                assert.equal(f(), obj);
            });
        });
    });

    describe("maybe_call", function() {
        it("should handle functions", function() {
            function f(b, c) {
                return this.a + b + c;
            }

            assert.equal(
                utils.maybe_call(f, {a: 'foo'}, ['bar', 'baz']),
                'foobarbaz');
        });

        it("should handle non-functions", function() {
            assert.equal(utils.maybe_call('foo'), 'foo');
        });
    });

    describe(".inherit", function() {
        it("should set up the child's prototype chain", function() {
            var Parent = function() {};
            var Child = utils.inherit(Parent, function() {});

            var c = new Child();
            assert(c instanceof Parent);
            assert(c instanceof Child);
        });

        it("should set the parent's static methods on the child",
        function() {
            var Parent = function() {};
            Parent.foo = 'bar';

            var Child = utils.inherit(Parent, function() {});
            assert.equal(Child.extend, Parent.extend);
            assert.equal(Child.foo, Parent.foo);
        });
    });

    describe(".url_encode", function() {
        it("should url encode the given url and params", function() {
            assert.equal(
                utils.url_encode('http://example.com/', [{
                    name: 'a',
                    value: 'f o o'
                }, {
                    name: 'b',
                    value: 'b a r'
                }, {
                    name: 'c',
                    value: null
                }]),
                'http://example.com/?a=f%20o%20o&b=b%20a%20r&c=null');
        });
    });

    describe(".url_decode", function() {
        it("should decode the url into its base and params", function() {
            assert.deepEqual(utils.url_decode(
                'http://example.com/?a=f%20o%20o&b=b%20a%20r&c=null'),
                {
                    url: 'http://example.com/',
                    params: [{
                        name: 'a',
                        value: 'f o o'
                    }, {
                        name: 'b',
                        value: 'b a r'
                    }, {
                        name: 'c',
                        value: 'null'
                    }]
                });
        });
    });


    describe(".starts_with", function() {
        it("should determine whether the one string starts with the other",
        function() {
            assert(utils.starts_with('', ''));
            assert(utils.starts_with('foo', ''));
            assert(utils.starts_with('foo', 'foo'));
            assert(utils.starts_with('foobar', 'foo'));
            assert(!utils.starts_with('foobar', 'foobarbaz'));
        });
    });

    describe(".deep_equals", function() {
        it("should determine whether the objects are deep equal", function() {
            assert(!utils.deep_equals({foo: 'bar'}, {foo: 'baz'}));
            assert(utils.deep_equals({foo: 'bar'}, {foo: 'bar'}));
        });
    });

    describe(".exists", function() {
        it("should return true if the value is not null or undefined",
        function() {
            assert(!utils.exists());
            assert(!utils.exists(null));
            assert(utils.exists(0));
            assert(utils.exists(''));
        });
    });

    describe(".is_integer", function() {
        it("should determine whether a value is an integer",
        function() {
            assert(!utils.is_integer());
            assert(!utils.is_integer(null));
            assert(!utils.is_integer('2'));
            assert(!utils.is_integer(2.1));
            assert(utils.is_integer(2));
        });
    });

    describe("Extendable", function() {
        var Extendable = utils.Extendable;

        describe(".extend", function() {
            it("should set up the child's prototype chain", function() {
                var Parent = Extendable.extend(function() {});
                var Child = Parent.extend(function() {});

                var p = new Parent();
                var c = new Child();

                assert(p instanceof Extendable);
                assert(p instanceof Parent);

                assert(c instanceof Extendable);
                assert(c instanceof Parent);
                assert(c instanceof Child);
            });

            it("should set the parent's static methods on the child",
            function() {
                var Parent = Extendable.extend(function() {});
                assert.equal(Parent.extend, Extendable.extend);
                Parent.foo = 'bar';

                var Child = Parent.extend(function() {});
                assert.equal(Child.extend, Parent.extend);
                assert.equal(Child.foo, Parent.foo);
            });

            describe("the returned constructor function", function() {
                it("should pass `this` to the actual constructor as an arg",
                function() {
                    var Thing = Extendable.extend(function(self, foo) {
                        self.foo = foo;
                    });

                    var thing = new Thing('bar');
                    assert.equal(thing.foo, 'bar');
                });
            });
        });
    });

    describe(".infer_addr_type", function() {
        it("should infer the address type for sms", function() {
            assert.equal(utils.infer_addr_type('sms'), 'msisdn');
        });

        it("should infer the address type for ussd", function() {
            assert.equal(utils.infer_addr_type('ussd'), 'msisdn');
        });

        it("should infer the address type for gtalk", function() {
            assert.equal(utils.infer_addr_type('gtalk'), 'gtalk_id');
        });

        it("should infer the address type for twitter", function() {
            assert.equal(utils.infer_addr_type('twitter'), 'twitter_handle');
        });

        it("should return undefined for unrecognized delivery classes",
        function() {
            assert.equal(
                typeof utils.infer_addr_type('unknown_type'),
                'undefined');
        });
    });

    describe(".format_addr", function() {
        it("should format msisdns", function() {
            assert.equal(utils.format_addr('27123', 'msisdn'), '+27123');
            assert.equal(utils.format_addr('+27123', 'msisdn'), '+27123');
        });

        it("should format gtalk ids", function() {
            assert.equal(utils.format_addr('foo/bar', 'gtalk_id'), 'foo');
            assert.equal(utils.format_addr('foo', 'gtalk_id'), 'foo');
        });

        it("should be a noop for other address types", function() {
            assert.equal(utils.format_addr('foo', 'unknown_type'), 'foo');
        });
    });
});
