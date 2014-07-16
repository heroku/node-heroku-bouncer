// jshint -W030

'use strict';

var Promise           = require('bluebird');
var request           = require('request');
var should            = require('should');
var tough             = require('tough-cookie');
var herokuStub        = require('./helpers/heroku');
var createClient      = require('./helpers/create-client');
var shared            = require('./helpers/shared');
var get               = Promise.promisify(request.get);
var post              = Promise.promisify(request.post);
var reqHandler        = function(req, res) { res.end('custom handler'); };
var client;

describe('bouncer', function() {
  var shouldNotRedirect, shouldRedirect;

  before(function() {
    this.clientOptions = {};
    shouldNotRedirect  = shared.shouldNotRedirect.bind(this);
    shouldRedirect     = shared.shouldRedirect.bind(this);
  });

  beforeEach(function() {
    return createClient(this.clientOptions).spread(function(newClient, url) {
      this.url = url;
      client   = newClient;
    }.bind(this));
  });

  afterEach(function(done) {
    client.close(done);
  });

  describe('when logged in', function() {
    var jar;

    context('and sessionSyncNonce is set', function() {
      before(function() {
        this.clientOptions = { sessionSyncNonce: 'my_session_nonce' };
      });

      beforeEach(function() {
        var cookie = new tough.Cookie({
          key  : 'my_session_nonce',
          value: 'my_session_nonce_value'
        });

        jar = request.jar();
        jar.setCookie(cookie, this.url);

        return get({
          jar: jar, // binks
          url: this.url
        });
      });

      it('adds a sessionSyncNonce to the session', function() {
        return get({
          jar : jar,
          url : this.url + '/session',
          json: true
        }).spread(function(_, body) {
          body.herokuBouncerSessionNonce.should.eql('my_session_nonce_value');
        });
      });

      context('and the sessionSyncNonce has changed', function() {
        it('asks the user to reauthorize', function() {
          var cookie = new tough.Cookie({
            key  : 'my_session_nonce',
            value: 'my_new_session_nonce_value'
          });

          jar.setCookie(cookie, this.url);

          return get({
            jar           : jar,
            url           : this.url + '/session',
            followRedirect: false
          }).spread(function(res) {
            res.headers.location.should.eql('/auth/heroku');
          });
        });
      });

      context('and the sessionSyncNonce has been removed', function() {
        it('asks the user to reauthorize', function() {
          var cookie = new tough.Cookie({
            key  : 'my_session_nonce',
            value: null
          });

          jar.setCookie(cookie, this.url);

          return get({
            jar           : jar,
            url           : this.url + '/session',
            followRedirect: false
          }).spread(function(res) {
            res.headers.location.should.eql('/auth/heroku');
          });
        });
      });
    });
  });

  describe('logging out', function() {
    before(function() {
      this.clientOptions = null;
    });

    it('redirects to the ID logout path', function() {
      var jar = request.jar();

      return get({
        jar: jar,
        url: this.url
      }).then(function() {
        return get({
          jar           : jar,
          url           : this.url + '/auth/heroku/logout',
          followRedirect: false
        });
      }.bind(this)).spread(function(res) {
        res.headers.location.should.eql('http://localhost:' + client.serverPort + '/logout');
      }.bind(this));
    });

    it('nullifies the session', function() {
      var jar = request.jar();

      return get({
        jar: jar,
        url: this.url
      }).then(function() {
        return get({
          jar: jar,
          url: this.url + '/auth/heroku/logout'
        });
      }.bind(this)).then(function() {
        return get({
          jar: jar,
          url: this.url + '/ignore'
        });
      }.bind(this)).spread(function(res) {
        should(res.headers['x-user-session']).be.empty;
      });
    });
  });

  describe('ignoring routes', function() {
    before(function() {
      this.clientOptions = null;
    });

    context('when there is no user session', function() {
      it('ignores specified routes', function() {
        return get({
          url           : this.url + '/ignore',
          followRedirect: false
        }).spread(function(res) {
          res.body.should.eql('no redirect');
        });
      });
    });

    context('when there is a user session', function() {
      it('uses its normal middleware', function() {
        var jar = request.jar();

        return get({
          jar: jar,
          url: this.url
        }).then(function() {
          return get({
            jar           : jar,
            url           : this.url + '/token',
            followRedirect: false
          });
        }.bind(this)).spread(function(res) {
          res.body.should.not.be.empty;
        });
      });
    });
  });
});
