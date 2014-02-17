var assert = require("assert");

var resources = require('../../lib/dummy/resources');
var DummyResourceError = resources.DummyResourceError;

var api = require('../../lib/dummy/api');
var DummyApi = api.DummyApi;

api = require('../../lib/http/api');
var HttpRequest = api.HttpRequest;

var dummy = require('../../lib/http/dummy');
var HttpFixture = dummy.HttpFixture;
var HttpFixtures = dummy.HttpFixtures;


describe("HttpFixture", function () {
    it("should allow a single response to be given", function() {
        var fixture = new HttpFixture({
            request: {url: 'http://example.com'},
            response: {code: 201}
        });

        assert.equal(fixture.responses[0].code, 201);
    });

    it("should allow a multiple responses to be given", function() {
        var fixture = new HttpFixture({
            request: {url: 'http://example.com'},
            responses: [
                {code: 201},
                {code: 403}]
        });

        assert.equal(fixture.responses[0].code, 201);
        assert.equal(fixture.responses[1].code, 403);
    });

    it("should use a default response if no responses are given", function() {
        var fixture = new HttpFixture({
            request: {url: 'http://example.com'}
        });

        assert.equal(fixture.responses[0].code, 200);
    });

    it("should json encode requests if asked", function() {
        var fixture = new HttpFixture({
            opts: {json: true},
            request: {
                url: 'http://example.com',
                data: {foo: 'bar'}
            }
        });

        assert.equal(fixture.request.body, '{"foo":"bar"}');
    });

    it("should json decode responses if asked", function() {
        var fixture = new HttpFixture({
            request: {url: 'http://example.com'},
            responses: [
                {body: '{"foo":"bar"}'},
                {body: '{"baz":"qux"}'}]
        });

        assert.deepEqual(fixture.responses[0].data, {foo: 'bar'});
        assert.deepEqual(fixture.responses[1].data, {baz: 'qux'});
    });

    describe(".use", function() {
        it("should return the next response", function() {
            var fixture = new HttpFixture({
                request: {url: 'http://example.com'},
                responses: [
                    {body: '{"foo":"bar"}'},
                    {body: '{"baz":"qux"}'}]
            });

            assert.strictEqual(fixture.use(), fixture.responses[0]);
            assert.strictEqual(fixture.use(), fixture.responses[1]);
        });

        it("should throw an error if it is used up", function() {
            var fixture = new HttpFixture({
                request: {url: 'http://example.com'},
                responses: [
                    {body: '{"foo":"bar"}'},
                    {body: '{"baz":"qux"}'}]
            });

            fixture.use();
            fixture.use();
            assert.throws(function() {
                fixture.use();
            }, DummyResourceError);
        });
    });
});

describe("HttpFixtures", function () {
    describe(".add", function() {
        it("should support adding a fixture from data", function() {
            var fixtures = new HttpFixtures();

            fixtures.add({
                request: {url: 'http://example.com'},
                response: {code: 201}
            });

            var request = new HttpRequest('get','http://example.com');
            var fixture = fixtures.find(request);

            assert(fixture instanceof HttpFixture);
            assert.equal(fixture.request.url, 'http://example.com');
            assert.equal(fixture.responses[0].code, 201);
        });

        it("should support adding an already initialised fixture", function() {
            var fixtures = new HttpFixtures();
            var fixture = new HttpFixture({
                request: {url: 'http://example.com'},
                response: {code: 201}
            });
            fixtures.add(fixture);

            var request = new HttpRequest('get','http://example.com');
            assert.equal(fixtures.find(request), fixture);
        });
    });

    describe(".matchers", function() {
        describe(".url", function() {
            it("should determine whether the request urls match", function() {
                var fixtures = new HttpFixtures();

                assert(!fixtures.matchers.url(
                    new HttpRequest('get','http://example.org'),
                    new HttpFixture({request: {url: 'http://example.com'}})));

                assert(fixtures.matchers.url(
                    new HttpRequest('get','http://example.com'),
                    new HttpFixture({request: {url: 'http://example.com'}})));
            });

            it("should support regexes", function() {
                var fixtures = new HttpFixtures();

                assert(!fixtures.matchers.url(
                    new HttpRequest('get','http://example.org'),
                    new HttpFixture({request: {url: /.*.com/}})));

                assert(fixtures.matchers.url(
                    new HttpRequest('get','http://example.com'),
                    new HttpFixture({request: {url: /.*.com/}})));
            });
        });

        describe(".params", function() {
            it("should determine whether the params match", function() {
                var fixtures = new HttpFixtures();

                assert(!fixtures.matchers.params(
                    new HttpRequest('get','http://example.com', {
                        params: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            params: [{
                                name: 'foo',
                                value: 'baz'
                            }]
                        }
                    })));

                assert(fixtures.matchers.params(
                    new HttpRequest('get','http://example.com', {
                        params: [{
                            name: 'foo',
                            value: 'bar'
                        }]
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            params: [{
                                name: 'foo',
                                value: 'bar'
                            }]
                        }
                    })));
            });

            it("should return true if both requests have no params",
            function() {
                var fixtures = new HttpFixtures();

                assert(fixtures.matchers.params(
                    new HttpRequest('get','http://example.com'),
                    new HttpFixture({request: {url: 'http://example.com'}})));
            });
        });

        describe(".body", function() {
            it("should determine whether the request bodies match",
            function() {
                var fixtures = new HttpFixtures({json: false});

                assert(!fixtures.matchers.body(
                    new HttpRequest('get','http://example.com', {
                        body: 'foo'
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            body: 'bar'
                        }
                    })));

                assert(fixtures.matchers.body(
                    new HttpRequest('get','http://example.com', {
                        body: 'foo'
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            body: 'foo'
                        }
                    })));
            });

            it("should do a deep equals test for json requests", function() {
                var fixtures = new HttpFixtures({json: true});

                assert(!fixtures.matchers.body(
                    new HttpRequest('get','http://example.com', {
                        data: {foo: 'bar'}
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            body: {foo: 'baz'}
                        }
                    })));

                assert(fixtures.matchers.body(
                    new HttpRequest('get','http://example.com', {
                        body: {foo: 'bar'}
                    }),
                    new HttpFixture({
                        request: {
                            url: 'http://example.com',
                            body: {foo: 'bar'}
                        }
                    })));
            });

            it("should return true if both requests have no bodies",
            function() {
                var fixtures = new HttpFixtures({json: false});

                assert(fixtures.matchers.body(
                    new HttpRequest('get','http://example.com'),
                    new HttpFixture({
                        request: {url: 'http://example.com'}
                    })));
            });

            it("should return true if both json requests have no data",
            function() {
                var fixtures = new HttpFixtures();

                assert(fixtures.matchers.body(
                    new HttpRequest('get','http://example.com'),
                    new HttpFixture({
                        request: {url: 'http://example.com'}
                    })));
            });
        });
    });

    describe(".find", function() {
        it("should return the matching fixture", function() {
            var fixtures = new HttpFixtures();

            var fixture_a = new HttpFixture({
                request: {
                    url: /.*a.*/,
                    params: [{
                        name: 'foo',
                        value: 'bar'
                    }],
                    data: {lerp: 'larp'}
                }
            });

            var fixture_b = new HttpFixture({
                request: {
                    method: 'post',
                    url: /.*b.*/,
                    params: [{
                        name: 'baz',
                        value: 'qux'
                    }],
                    data: {lorem: 'lark'}
                }
            });

            fixtures.add(fixture_a);
            fixtures.add(fixture_b);

            assert.strictEqual(
                fixtures.find(new HttpRequest('get','http://a.com', {
                    params: [{
                        name: 'foo',
                        value: 'bar'
                    }],
                    data: {lerp: 'larp'}
                })),
                fixture_a);

            assert.strictEqual(
                fixtures.find(new HttpRequest('post','http://b.com', {
                    params: [{
                        name: 'baz',
                        value: 'qux'
                    }],
                    data: {lorem: 'lark'}
                })),
                fixture_b);
        });

        it("should throw an error if there are no matches", function() {
            var fixtures = new HttpFixtures();
            fixtures.add(new HttpFixture({request: {url: /.*a.*/}}));

            assert.throws(function() {
                fixtures.find(new HttpRequest('get','http://b.com'));
            }, DummyResourceError);
        });

        it("should throw an error if there are multiple matches", function() {
            var fixtures = new HttpFixtures();
            fixtures.add(new HttpFixture({request: {url: /.*a.*/}}));
            fixtures.add(new HttpFixture({request: {url: /.*a.*/}}));

            assert.throws(function() {
                fixtures.find(new HttpRequest('get','http://a.com'));
            }, DummyResourceError);
        });
    });
});

describe("DummyHttpResource", function () {
    var api;

    beforeEach(function() {
        api = new DummyApi();
    });

    describe(".request_from_cmd", function() {
        it("should convert the command's headers into request headers");
        it("should convert the command's params into request params");
        it("should decode the request body if it is a json request");
    });

    describe(".handlers", function() {
        describe("request handlers", function() {
            it("should respond with the matching fixture's next response");
            it("should throw an error if the fixture is used up");
            it("should record the request");
        });

        describe(".get", function() {
            it("should perform dummy get requests");
        });

        describe(".head", function() {
            it("should perform dummy head requests");
        });

        describe(".post", function() {
            it("should perform dummy post requests");
        });

        describe(".delete", function() {
            it("should perform dummy delete requests");
        });
    });
});
