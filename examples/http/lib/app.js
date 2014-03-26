var vumigo = require('../../../lib');

var App = vumigo.App;
var MenuState = vumigo.states.MenuState;
var Choice = vumigo.states.Choice;
var EndState = vumigo.states.EndState;
var FreeText = vumigo.states.FreeText;
var InteractionMachine = vumigo.InteractionMachine;
var JsonApi = vumigo.http.api.JsonApi;


var HttpApp = App.extend(function(self) {
    App.call(self, 'states:start');

    self.init = function() {
        // We use `JsonApi` here. This ensure requests are json encoded and
        // responses are json decoded.
        self.http = new JsonApi(self.im);
    };

    self.states.add('states:start', function(name) {
        return new MenuState(name, {
            question: "Choose your destiny:",

            choices: [
                new Choice('states:put', "Put something"),
                new Choice('states:post', "Post something")]
        });
    });

    self.states.add('states:put', function(name) {
        // When the user has responded, we put their response to
        // httpbin.org. Once httpbin.org has responded, we tell the interaction
        // machine to go to 'states:done' next. Instead of just giving it the
        // states name, we also give it additional options: the method that was
        // performed, and httpbin.org's echo of the content in the response.
        return new FreeText(name, {
            question: 'What would you like to put?',

            next: function(content) {
                return self
                    .http.put('http://httpbin.org/put', {
                        data: {message: content}
                    })
                    .then(function(resp) {
                        return {
                            name: 'states:done',
                            creator_opts: {
                                method: 'put',
                                echo: resp.data.json.message
                            }
                        };
                    });
            }
        });
    });

    self.states.add('states:post', function(name) {
        // Similarly to the put requests above, we send it to httpbin.org, then
        // tell the interaction machine to go to 'states:done', giving it the
        // method that was performed and httpbin.org's echo of the content.
        return new FreeText(name, {
            question: 'What would you like to post?',

            next: function(content) {
                return self
                    .http.post('http://httpbin.org/post', {
                        data: {message: content}
                    })
                    .then(function(resp) {
                        return {
                            name: 'states:done',
                            creator_opts: {
                                method: 'post',
                                echo: resp.data.json.message
                            }
                        };
                    });
            }
        });
    });

    self.states.add('states:done', function(name, opts) {
        // Here we use the options given in 'states:put' and 'states:post' to
        // show the appropriate message.
        return new EndState(name, {
            text: [
                "You just performed a " + opts.method + ".",
                "It was echoed back: " + opts.echo
            ].join(' '),
            next: 'states:start'
        });
    });
});


if (typeof api != 'undefined') {
    new InteractionMachine(api, new HttpApp());
}


this.HttpApp = HttpApp;
