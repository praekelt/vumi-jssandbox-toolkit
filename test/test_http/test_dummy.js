var Q = require('q');
var assert = require('assert');

var vumigo = require('../../lib');
var utils = vumigo.utils;
var DummyApi = vumigo.dummy.api.DummyApi;
var DummyResourceError = vumigo.dummy.resources.DummyResourceError;
var HttpRequest = vumigo.http.api.HttpRequest;

var dummy = vumigo.http.dummy;
var HttpFixture = dummy.HttpFixture;
var HttpFixtures = dummy.HttpFixtures;


describe("http.dummy", function() {
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

        it("should use a default response if no responses are given",
        function() {
            var fixture = new HttpFixture({
                request: {url: 'http://example.com'}
            });

            assert.equal(fixture.responses[0].code, 200);
        });

        it("should use params given in the url if relevant", function() {
            var fixture = new HttpFixture({
                request: {
                    url: 'http://example.com/?foo=b%20a%20r',
                    params: {foo: 'baz'}
                }
            });

            assert.equal(fixture.request.url, 'http://example.com/');
            assert.deepEqual(fixture.request.params, {foo: 'b a r'});
        });

        it("should encode requests", function() {
            var fixture = new HttpFixture({
                default_encoding: 'json',
                request: {
                    url: 'http://example.com',
                    data: {foo: 'bar'}
                }
            });

            assert.equal(fixture.request.body, '{"foo":"bar"}');
        });

        it("should decode responses", function() {
            var fixture = new HttpFixture({
                default_encoding: 'json',
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

            it("should allow fixtures to be repeatable", function() {
                var fixture = new HttpFixture({
                    repeatable: true,
                    request: {url: 'http://example.com'},
                    response: {body: '{"foo":"bar"}'}
                });

                assert.deepEqual([fixture.use()], fixture.responses);
                assert.deepEqual([fixture.use()], fixture.responses);
                assert.deepEqual([fixture.use()], fixture.responses);
                assert.deepEqual([fixture.use()], fixture.responses);
                assert.deepEqual([fixture.use()], fixture.responses);
            });
        });

        describe(".serialize", function() {
            it("should include its uses", function() {
                var fixture = new HttpFixture({
                    request: {url: 'http://example.com'},
                    responses: [
                        {body: '{"foo":"bar"}'},
                        {body: '{"baz":"qux"}'}]
                });

                fixture.use();
                fixture.use();

                assert.equal(fixture.serialize().uses, 2);
            });

            it("should include its request", function() {
                var fixture = new HttpFixture({
                    request: {url: 'http://example.com'}
                });

                assert.deepEqual(
                    fixture.serialize().request,
                    fixture.request.serialize());
            });

            it("should include its responses", function() {
                var fixture = new HttpFixture({
                    request: {url: 'http://example.com'},
                    responses: [
                        {body: '{"foo":"bar"}'},
                        {body: '{"baz":"qux"}'}]
                });

                assert.deepEqual(
                    fixture.serialize().responses,
                    fixture.responses.map(function(r) { return r.serialize(); }));
            });
        });

        describe("it should use its serialized data", function() {
            var fixture = new HttpFixture({
                request: {url: 'http://example.com'},
                responses: [
                    {body: '{"foo":"bar"}'},
                    {body: '{"baz":"qux"}'}]
            });

            assert.equal(fixture.toString(), utils.pretty(fixture.serialize()));
        });
    });

    describe("HttpFixtures", function () {
        describe(".add", function() {
            it("should support adding a fixture from data", function() {
                var fixtures = new HttpFixtures();

                var created_fixture = fixtures.add({
                    request: {url: 'http://example.com'},
                    response: {code: 201}
                });

                var request = new HttpRequest('get','http://example.com');
                var fixture = fixtures.filter(request)[0];

                assert(fixture instanceof HttpFixture);
                assert.equal(fixture.request.url, 'http://example.com/');
                assert.equal(fixture.responses[0].code, 201);
                assert.strictEqual(created_fixture, fixture);
            });

            it("should support adding an already initialised fixture",
            function() {
                var fixtures = new HttpFixtures();
                var fixture = new HttpFixture({
                    request: {url: 'http://example.com'},
                    response: {code: 201}
                });
                var added_fixture = fixtures.add(fixture);

                var request = new HttpRequest('get','http://example.com');
                assert.equal(fixtures.filter(request)[0], fixture);
                assert.strictEqual(added_fixture, fixture);
            });
        });

        describe(".matchers", function() {
            describe(".url", function() {
                it("should determine whether the request urls match",
                function() {
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
                        new HttpFixture({
                            request: {url: 'http://example.com'}
                        })));
                });
            });

            describe(".body", function() {
                it("should determine whether the request bodies match",
                function() {
                    var fixtures = new HttpFixtures();

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

                it("should do a deep equals test both requests have data",
                function() {
                    var fixtures = new HttpFixtures();

                    assert(!fixtures.matchers.body(
                        new HttpRequest('get','http://example.com', {
                            data: {foo: 'bar'}
                        }),
                        new HttpFixture({
                            request: {
                                url: 'http://example.com',
                                data: {foo: 'baz'}
                            }
                        })));

                    assert(fixtures.matchers.body(
                        new HttpRequest('get','http://example.com', {
                            data: {foo: 'bar'}
                        }),
                        new HttpFixture({
                            request: {
                                url: 'http://example.com',
                                data: {foo: 'bar'}
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

        describe(".filter", function() {
            it("should return the matching fixtures", function() {
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

                assert.deepEqual(
                    fixtures.filter(new HttpRequest('get','http://a.com', {
                        params: [{
                            name: 'foo',
                            value: 'bar'
                        }],
                        data: {lerp: 'larp'}
                    })),
                    [fixture_a]);

                assert.deepEqual(
                    fixtures.filter(new HttpRequest('post','http://b.com', {
                        params: [{
                            name: 'baz',
                            value: 'qux'
                        }],
                        data: {lorem: 'lark'}
                    })),
                    [fixture_b]);
            });
        });
    });

    describe("DummyHttpResource", function () {
        var api;

        beforeEach(function() {
            api = new DummyApi({
                http: {default_encoding: 'json'}
            });
        });

        function request(name, cmd) {
            var d = Q.defer();
            api.request(name, cmd, function(result) {
                d.resolve(result);
            });
            return d.promise;
        }

        describe(".request_from_cmd", function() {
            it("should convert the command's headers into request headers",
            function() {
                var request = api.http.request_from_cmd({
                    cmd: 'http.get',
                    url: 'http://example.com',
                    headers: {foo: ['bar', 'baz']}
                });

                assert.deepEqual(request.headers, {foo: ['bar', 'baz']});
            });

            it("should convert the command's params into request params",
            function() {
                var request = api.http.request_from_cmd({
                    cmd: 'http.get',
                    url: 'http://example.com/?foo=bar&baz=qux'
                });

                assert.deepEqual(request.params, {
                    foo: 'bar',
                    baz: 'qux'
                });
            });

            it("should json decode the request body if asked", function() {
                var request = api.http.request_from_cmd({
                    cmd: 'http.get',
                    url: 'http://example.com/?foo=bar&baz=qux',
                    data: JSON.stringify({foo: 'bar'})
                });

                assert.deepEqual(request.data, {foo: 'bar'});
            });

            it("should support commands with verify options", function() {
                var request = api.http.request_from_cmd({
                    cmd: 'http.get',
                    url: 'http://example.com',
                    verify_options: ['VERIFY_NONE']
                });

                assert.deepEqual(request.verify_options, ['VERIFY_NONE']);
            });

            it("should support commands with an ssl method", function() {
                var request = api.http.request_from_cmd({
                    cmd: 'http.get',
                    url: 'http://example.com',
                    ssl_method: 'SSLv3'
                });

                assert.equal(request.ssl_method, 'SSLv3');
            });
        });

        describe(".handlers", function() {
            describe("request handlers", function() {
                it("should respond with the matching fixture's next response",
                function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'head',
                            url: 'http://example.com'
                        },
                        response: {
                            code: 201,
                            data: {foo: 'bar'}
                        }
                    });

                    return request('http.head', {
                        url: 'http://example.com'
                    }).then(function(result) {
                        assert.equal(result.code, 201);
                        assert.equal(result.body, JSON.stringify({
                            foo: 'bar'
                        }));
                    });
                });

                it("should fail if the fixture is used up", function() {
                    api.http.fixtures.add({
                        request: {url: 'http://example.com'}
                    });

                    return request('http.get', {
                        url: 'http://example.com'
                    }).then(function() {
                        return request('http.get', {
                            url: 'http://example.com'
                        });
                    }).then(function(result) {
                        assert(!result.success);
                    });
                });

                it("should fail if there are no matches", function() {
                    api.http.fixtures.add({request: {url: /.*a.*/}});

                    return request('http.get', {
                        url: 'http://b.com'
                    }).then(function(result) {
                        assert(!result.success);
                    });
                });

                it("should fail if there are multiple matches", function() {
                    api.http.fixtures.add({request: {url: /.*a.*/}});
                    api.http.fixtures.add({request: {url: /.*com/}});

                    return request('http.get', {
                        url: 'http://a.com'
                    }).then(function(result) {
                        assert(!result.success);
                    });
                });

                it("should fail if there are any non-array headers", function() {
                    api.http.fixtures.add({request: {url: /.*a.*/}});

                    return request('http.get', {
                        url: 'http://a.com',
                        headers: {
                            'foo': ['bar'],
                            'bar': 'baz',
                        }
                    }).then(function(result) {
                        assert(!result.success);
                    });
                });

                it("should record the request", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'head',
                            url: 'http://example.com'
                        }
                    });

                    return request('http.head', {
                        url: 'http://example.com'
                    }).then(function() {
                        var request = api.http.requests[0];
                        assert(request instanceof HttpRequest);
                        assert.equal(request.method, 'HEAD');
                        assert.equal(request.url, 'http://example.com/');
                    });
                });
            });

            describe(".get", function() {
                it("should perform dummy get requests", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'get',
                            url: 'http://example.com'
                        },
                        response: {
                            code: 201,
                            data: {foo: 'bar'}
                        }
                    });

                    return request('http.get', {
                        url: 'http://example.com'
                    }).then(function(result) {
                        assert.equal(result.code, 201);
                        assert.equal(result.body, '{"foo":"bar"}');
                    });
                });
            });

            describe(".head", function() {
                it("should perform dummy head requests", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'head',
                            url: 'http://example.com'
                        },
                        response: {code: 201}
                    });

                    return request('http.head', {
                        url: 'http://example.com'
                    }).then(function(result) {
                        assert.equal(result.code, 201);
                    });
                });
            });

            describe(".post", function() {
                it("should perform dummy post requests", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'post',
                            url: 'http://example.com',
                            data: {lerp: 'larp'}
                        },
                        response: {
                            data: {foo: 'bar'}
                        }
                    });

                    return request('http.post', {
                        url: 'http://example.com',
                        data: JSON.stringify({lerp: 'larp'})
                    }).then(function(result) {
                        assert.equal(result.code, 200);
                        assert.equal(result.body, '{"foo":"bar"}');
                    });
                });
            });

            describe(".patch", function() {
                it("should perform dummy patch requests", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'patch',
                            url: 'http://example.com',
                            data: {lerp: 'larp'}
                        },
                        response: {
                            data: {foo: 'bar'}
                        }
                    });

                    return request('http.patch', {
                        url: 'http://example.com',
                        data: JSON.stringify({lerp: 'larp'})
                    }).then(function(result) {
                        assert.equal(result.code, 200);
                        assert.equal(result.body, '{"foo":"bar"}');
                    });
                });
            });

            describe(".delete", function() {
                it("should perform dummy delete requests", function() {
                    api.http.fixtures.add({
                        request: {
                            method: 'delete',
                            url: 'http://example.com',
                            data: {lerp: 'larp'}
                        },
                        response: {
                            code: 204,
                            data: {foo: 'bar'}
                        }
                    });

                    return request('http.delete', {
                        url: 'http://example.com',
                        data: JSON.stringify({lerp: 'larp'})
                    }).then(function(result) {
                        assert.equal(result.code, 204);
                        assert.equal(result.body, '{"foo":"bar"}');
                    });
                });
            });
        });
    });

    describe("infer_encoding", function() {
        it("should infer json encodings", function() {
            assert.equal(
                dummy.infer_encoding({
                    'Content-Type': ['application/json']
                }),
                dummy.encodings.json);

            assert.equal(
                dummy.infer_encoding({
                    'Content-Type': ['application/json; charset=utf8']
                }),
                dummy.encodings.json);
        });

        it("should fallback to a 'none' encoding", function() {
            assert.equal(
                dummy.infer_encoding({'Content-Type': ['foo']}),
                dummy.encodings.none);
        });
    });
});
