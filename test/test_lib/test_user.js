var Q = require("q");
var assert = require("assert");

var vumigo = require("../../lib");
var test_utils = vumigo.test_utils;
var User = vumigo.user.User;


describe("User", function() {
    var im;
    var user;

    beforeEach(function(done) {
        test_utils.make_im().then(function(new_im) {
            im = new_im;
            user = im.user;
        }).nodeify(done);
    });

    it("should be JSON serializable", function() {
        assert.equal(JSON.stringify(user), JSON.stringify({
            addr: '+27123456789',
            lang: 'af',
            answers: {start: 'yes'},
            current_state_name: 'start'
        }));
    });

    describe(".setup", function() {
        beforeEach(function() {
            user = new User(im);
        });

        it("should emit a 'setup' event", function(done) {
            user.on('setup', function(e) {
                assert.strictEqual(user, e.instance);
                done();
            });

            user.setup('+27123456789');
        });

        it("should setup the user", function(done) {
            user.setup('+27123456789', {
                lang: 'af',
                answers: {start: 'yes'},
                current_state_name: 'start'
            }).then(function() {
                assert.equal(user.addr, '+27123456789');
                assert.equal(user.lang, 'af');
                assert.equal(user.get_answer('start'), 'yes');
                assert.equal(user.current_state_name, 'start');
                assert.equal(user.i18n.gettext('yes'), 'ja');
            }).nodeify(done);
        });
    });

    describe(".create", function() {
        it("should emit a 'user:new' event after setting up",
        function(done) {
            var setup = false;

            user.on('setup', function() {
                setup = true;
            });

            user.on('user:new', function() {
                assert(setup);
                done();
            });

            user.create('1234');
        });
    });

    describe(".load", function() {
        describe("if the user exists", function() {
            it("should load the user", function(done) {
                user.load('+27123456789').then(function() {
                    assert.equal(user.addr, '+27123456789');
                    assert.equal(user.lang, 'af');
                    assert.equal(user.get_answer('start'), 'yes');
                    assert.equal(user.current_state_name, 'start');
                    assert.equal(user.i18n.gettext('yes'), 'ja');
                }).nodeify(done);
            });

            it("should emit a 'user:load' event", function(done) {
                user.on('user:load', function(e) {
                    assert.equal(user, e.user);
                    done();
                });

                user.load('+27123456789');
            });
        });

        describe("if the user does not exist", function() {
            it("should throw an error", function(done) {
                user.load('i-do-not-exist').catch(function() {
                    done();
                });
            });
        });
    });

    describe(".load_or_create", function() {
        describe("if the user exists", function() {
            it("should load the user", function(done) {
                user.load('+27123456789').then(function() {
                    assert.equal(user.addr, '+27123456789');
                    assert.equal(user.lang, 'af');
                    assert.equal(user.get_answer('start'), 'yes');
                    assert.equal(user.current_state_name, 'start');
                    assert.equal(user.i18n.gettext('yes'), 'ja');
                }).nodeify(done);
            });

            it("should emit a 'user:load' event", function(done) {
                user.on('user:load', function(e) {
                    assert.equal(user, e.user);
                    done();
                });

                user.load('+27123456789');
            });
        });

        describe("if the user does not exist", function() {
            it("should create a new user", function(done) {
                user.load_or_create('i-do-not-exist').then(function() {
                    assert.equal(user.addr, 'i-do-not-exist');
                }).nodeify(done);
            });

            it("should emit a 'user:new' event", function(done) {
                user.on('user:new', function(e) {
                    assert.equal(user, e.user);
                    done();
                });

                user.load_or_create('i-do-not-exist');
            });
        });
    });

    describe(".save", function() {
        it("should save the user", function() {
            user.set_answer('why', 'no');

            user
                .save()
                .then(function() {
                    user = new User();
                    return user.load('+27123456789');
                })
                .then(function() {
                    assert.equal(user.get_answert('why'), 'no');
                });
        });

        it("should emit a 'user:save' event", function(done) {
            user.on('user:save', function(e) {
                assert.equal(e.user, user);
                done();
            });

            user.save();
        });
    });

    describe(".set_lang", function() {
        it("should change the user's language", function(done) {
            user.set_lang('jp').then(function() {
                assert.equal(user.lang, 'jp');
                assert.equal(user.i18n.gettext('yes'), 'hai');
            }).nodeify(done);
        });
    });
});
