var _ = require('lodash');
var url_utils = require('url');
var querystring = require('querystring');

var utils = require('../utils');
var Extendable = utils.Extendable;

var api = require('./api');
var HttpRequest = api.HttpRequest;
var HttpResponse = api.HttpResponse;

var resources = require('../dummy/resources');
var DummyResource = resources.DummyResource;
var DummyResourceError = resources.DummyResourceError;


var encodings = {
    none: {
        encoder: _.identity,
        decoder: _.identity
    },
    json: {
        encoder: JSON.stringify,
        decoder: JSON.parse
    }
};


var HttpFixture = Extendable.extend(function(self, opts) {
    /**class:HttpFixture(opts)

    Encapsulates an expected http request and the responses that be sent back.

    :type opts.request.url:
        string or :class:`RegExp`
    :param opts.request.url:
        The request url. If a string is given, the url may include params.  If
        the params are included, these will be decoded and set as the
        :class:`HttpRequest`\'s params.
    :param string opts.request.method:
        The request method. Defaults to 'GET'.
    :param object opts.request.data:
        The request's un-encoded body data. Optional.
    :param object opts.request.body:
        The request's already encoded body data. Optional.
    :type opts.request.params:
        object or array
    :param opts.request.params:
        An object of key-value pairs to append to the URL as query
        parameters. Can be in any form accepted by node.js's querystring
        module
    :param object opts.request.headers:
        An object mapping each header name to an array of header values.
    :param object opts.response:
        A single response to use for this fixture, for cases where one request
        is sent out.
    :param integer opts.response.code:
        The response's status code
    :param object opts.response.data:
        The responses's decoded body data. Optional.
    :param object opts.response.body:
        The response's un-decoded body data. Optional.
    :param array opts.responses:
        An array of response data objects to use one after the other each time
        a new request is sent out.
    :param boolean opts.repeatable:
        Configures the fixture's response to be reused for every new request.
        Defaults to `false`.
    :param string opts.default_encoding:
        The encoding to use for encoding requests and decoding responses.
        Possible values are 'json' and 'none'. If the request's 'Content-Type'
        header is set, the encoding is inferred using that instead.

    Either ``opts.response`` or ``opts.responses`` can be specified, or
    neither, but not both. If no responses are given, an 'empty' response with
    a status code of 200 is used.
    */
    self.defaults = {
        default_encoding: 'none',
        request: {method: 'GET'},
        response: {code: 200},
        repeatable: false
    };

    self.init = function(opts) {
        var request = opts.request;
        var responses = opts.responses || [opts.response || {}];
        _.defaults(opts, self.defaults);

        if ('Content-Type' in (request.headers || {})) {
            self.encoding = infer_encoding(request.headers);
        } else {
            self.encoding = encodings[opts.default_encoding];
        }

        self.repeatable = opts.repeatable;
        self.request = self.parse.request(request);
        self.responses = responses.map(self.parse.response);
        self.reset();
    };

    self.reset = function() {
        self.uses = 0;
    };

    self.parse = {};

    self.parse.request = function(request) {
        var url = request.url;

        _.defaults(request, self.defaults.request);
        request.encoder = self.encoding.encoder;

        if (!_.isRegExp(request.url)) {
            var url_data = url_utils.parse(request.url);
            var params = querystring.decode(url_data.query);
            url = url_utils.format(_.omit(url_data, 'search', 'query'));

            if (_.size(params)) {
                request.params = params;
            }
        }

        request = new HttpRequest(request.method, url, request);
        request.encode();
        return request;
    };

    self.parse.response = function(response) {
        _.defaults(response, self.defaults.response);
        response.decoder = self.encoding.decoder;

        if (response.data) {
            response.body = self.encoding.encoder(response.data);
        }

        response = new HttpResponse(self.request, response.code, response);
        response.decode();
        return response;
    };

    self.use = function() {
        /**:HttpFixture.use()
        Returns the fixture's next unused :class:`HttpResponse`.
        */
        var len = self.responses.length;

        if (!self.repeatable && self.uses === len) {
            throw new DummyResourceError([
                "All of the fixture's responses have been used up: " + self
            ].join(' '));
        }

        return self.responses[Math.min(self.uses++, len - 1)];
    };

    self.serialize = function() {
        return {
            uses: self.uses,
            request: self.request.serialize(),
            responses: self.responses
                .map(function(resp) { return resp.serialize(); })
        };
    };

    self.toString = function() {
        var data = self.serialize();
        return utils.pretty(data);
    };

    self.init(opts);
});


var HttpFixtures = Extendable.extend(function(self, opts) {
    /**class:HttpFixtures(opts)

    Manages a set of :class:`HttpFixture` instances.

    :param function opts.match:
        A function of the form ``f(request, fixture)``, where ``request`` is
        the request that needs a match, and ``fixture`` is the current
        :class:`HttpFixture` being tested as a match. Should return ``true`` if
        the request and fixture match or ``false`` if they do not match.
    :param boolean opts.defaults:
        Defaults to use for each added fixture.
    :param string opts.default_encoding:
        The encoding to use for encoding requests and decoding responses.
        Possible values are 'json' and 'none'. If a request's 'Content-Type'
        header is set, the encoding is inferred using that instead.
    */
    opts = _.defaults(opts || {}, {
        defaults: {},
        default_encoding: 'none'
    });

    self.encoding = encodings[opts.encoding];
    self.fixture_defaults = _.defaults(opts.defaults, {
        request: {},
        response: {},
        default_encoding: opts.default_encoding
    });
    self.fixtures = [];

    self.matcher = opts.match || function(request, fixture) {
        return self.matchers.params(request, fixture)
            && self.matchers.body(request, fixture);
    };

    self.match = function(request, fixture) {
        return self.matchers.method(request, fixture)
            && self.matchers.url(request, fixture)
            && self.matcher.call(self, request, fixture);
    };

    self.matchers = {};

    self.matchers.method = function(request, fixture) {
        return fixture.request.method === request.method;
    };

    self.matchers.url = function(request, fixture) {
        return _.isRegExp(fixture.request.url)
            ? fixture.request.url.test(request.url)
            : fixture.request.url === request.url;
    };

    self.matchers.params = function(request, fixture) {
        return _.isEqual(request.params, fixture.request.params);
    };

    self.matchers.body = function(request, fixture) {
        return request.data && fixture.request.data
            ? _.isEqual(request.data, fixture.request.data)
            : request.body === fixture.request.body;
    };

    self.add = function(obj) {
        /**:HttpFixtures.add(data)
        Adds an http fixture to the fixture set from raw data.

        :param object data:
            The properties of the fixture to be added.
            See :class:`HttpFixture`.

        :returns:
            The :class:`HttpFixture` that was created.
        */
        /**HttpFixtures.add(fixture)
        Adds an already initialised fixture to the fixture set.

        :param HttpFixture fixture:
            The fixture to be added.

        :returns:
            The :class:`HttpFixture` that was passed in.
        */
        if (!(obj instanceof HttpFixture)) {
            obj = self.create(obj);
        }
        self.fixtures.push(obj);
        return obj;
    };

    self.create = function(data) {
        _.defaults(data, {
            request: {},
            response: {},
        });
        _.defaults(data.request, self.fixture_defaults.request);
        _.defaults(data.response, self.fixture_defaults.response);
        _.defaults(data, self.fixture_defaults);
        return new HttpFixture(data);
    };

    self.filter = function(request) {
        /**:HttpFixtures.filter(request)
        Finds the fixtures that match the given request.

        :param HttpRequest request:
            The request to find a match for.
        */
        return self.fixtures.filter(function(fixture) {
            return self.match(request, fixture);
        });
    };
});


var DummyHttpResource = DummyResource.extend(function(self, name, opts) {
    /**class:DummyHttpResource(name, opts)

    Handles api requests to the http resource from :class:`DummyApi`.

    :param string name:
        The name of the resource. Should match the name given in api requests.
    :param string opts.default_encoding:
        The encoding to use for encoding requests and decoding responses.
        Possible values are ``'json'`` and ``'none'``. If a request's
        ``Content-Type`` header is set, the encoding is inferred using that
        instead.
    */
    DummyResource.call(self, name);
    opts = _.defaults(opts || {}, {default_encoding: 'json'});
    self.encoding = encodings[opts.default_encoding];

    /**attribute:DummyHttpResource.requests
    A list of http requests that have been sent to the resource, where each is
    of type :class:`HttpRequest`.
    */
    self.requests = [];

    /**attribute:DummyHttpResource.fixtures
    The resource's fixture set to use to send out responses to requests.
    See :class:`HttpFixtures`.
    */
    self.fixtures = new HttpFixtures({
        default_encoding: opts.default_encoding
    });

    self.request_from_cmd = function(cmd) {
        var method = cmd.cmd.split('.', 2)[1];

        var encoding;
        if ('Content-Type' in (cmd.headers || {})) {
            encoding = infer_encoding(cmd.headers);
        }
        else {
            encoding = self.encoding;
        }

        var opts = _.pickBy({
            body: cmd.data,
            headers: cmd.headers,
            encoder: encoding.encoder,
            params: utils.url_params(cmd.url),
            verify_options: cmd.verify_options,
            ssl_method: cmd.ssl_method
        }, _.identity);

        if (cmd.data) {
            opts.data = encoding.decoder(cmd.data);
        }

        var url = utils.url_without_params(cmd.url);
        var request = new HttpRequest(method, url, opts);
        request.encode();
        return request;
    };

    self.handle_request = function(cmd) {
        var request = self.request_from_cmd(cmd);
        var fixtures = self.fixtures.filter(request);

        if (!fixtures.length) {
            throw new DummyResourceError("Found no matching fixtures");
        }

        if (fixtures.length > 1) {
            fixtures = fixtures.map(function(f) { return f.serialize(); });

            throw new DummyResourceError([
                "Found " + fixtures.length + " matching fixtures, expected 1:",
                utils.indent(utils.pretty(fixtures))
            ].join('\n'));
        }

        _.forEach(request.headers, function (value, key) {
            if (!_.isArray(value)) {
                throw new DummyResourceError([
                    "Header '" + key + "' must be an Array:",
                    utils.indent(utils.pretty(request))
                ]);
            }
        });

        var response = fixtures[0].use();
        self.requests.push(request);

        return {
            success: true,
            code: response.code,
            body: response.body
        };
    };

    self.handlers.get = self.handle_request;
    self.handlers.head = self.handle_request;
    self.handlers.post = self.handle_request;
    self.handlers.patch = self.handle_request;
    self.handlers.put = self.handle_request;
    self.handlers.delete = self.handle_request;
});


function infer_encoding(headers) {
    function content_is(content_type) {
        return _.find(headers['Content-Type'] || [], function(v) {
            return v.indexOf(content_type) > -1;
        });
    }

    if (content_is('application/json')) {
        return encodings.json;
    }

    return encodings.none;
}


this.HttpFixture = HttpFixture;
this.HttpFixtures = HttpFixtures;
this.DummyHttpResource = DummyHttpResource;

this.encodings = encodings;
this.infer_encoding = infer_encoding;
