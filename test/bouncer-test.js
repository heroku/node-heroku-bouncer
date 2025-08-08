// jshint -W030

'use strict';

require('should');
require('./test-helper');

var Promise       = require('bluebird');
var tough         = require('tough-cookie');
var createClient  = require('./helpers/create-client');
var herokuStubber = require('./helpers/heroku');
var httpUtils     = require('./helpers/http-utils');
var get           = function(url, options) { return Promise.resolve(httpUtils.get(url, options)); };
var post          = function(url, options) { return Promise.resolve(httpUtils.post(url, options)); };
var oAuthServer  = require('./fixtures/mock-oauth-server');
var client;

describe('bouncer', function() {
  afterEach(function() {
    return new Promise(function(resolve) {
      if (client.address()) {
        client.close(resolve);
      } else {
        resolve();
      }
    });
  });

  describe('when the user is not logged in', function() {
    context('and it is a non-JSON GET request', function() {
      it('redirects to /auth/heroku', function() {
        return withClient().spread(function(client, url) {
          return get(url, { followRedirect: false });
        }).spread(function(res) {
          res.headers.location.should.eql('/auth/heroku');
        });
      });
    });

    context('and it is a non-GET request', function() {
      it('returns a 401', function() {
        return withClient().spread(function(client, url) {
          return post(url);
        }).spread(function(res) {
          res.statusCode.should.eql(401);
        });
      });

      it('returns an unauthorized message', function() {
        return withClient().spread(function(client, url) {
          return post(url);
        }).spread(function(res, body) {
          JSON.parse(body).should.eql({ id: 'unauthorized', message: 'Please authenticate.' });
        });
      });
    });

    context('and it is a JSON request', function() {
      it('returns a 401', function() {
        return withClient().spread(function(client, url) {
          return get(url, { json: true });
        }).spread(function(res) {
          res.statusCode.should.eql(401);
        });
      });

      it('returns an unauthorized message', function() {
        return withClient().spread(function(client, url) {
          return get(url, { json: true });
        }).spread(function(res, body) {
          body.should.eql({ id: 'unauthorized', message: 'Please authenticate.' });
        });
      });
    });
  });

  context('when the user is logged in', function() {
    it('performs the request like normal', function() {
      return itBehavesLikeANormalRequest();
    });

    context('when the access token has expired', function() {
      context('and the refresh errors', function() {
        it('clears the session');

        context('and it is a non-JSON GET request', function() {
          it('redirects to /auth/heroku');
        });

        context('and it is a non-GET request', function() {
          it('returns a 401');
          it('returns an unable to reauthenticate error message');
        });

        context('and it is a JSON request', function() {
          it('returns a 401');
          it('returns an unable to reauthenticate error message');
        });
      });

      context('and the refresh responds with a non-200 status code', function() {
        it('clears the session');

        context('and it is a non-JSON GET request', function() {
          it('redirects to /auth/heroku');
        });

        context('and it is a non-GET request', function() {
          it('returns a 401');
          it('returns an unable to reauthenticate error message');
        });

        context('and it is a JSON request', function() {
          it('returns a 401');
          it('returns an unable to reauthenticate error message');
        });
      });

      context('and the refresh succeeds', function() {
        // access tokens expire in 0 seconds in mock server
        it('sets the new access token', function() {
          return authenticate().spread(function(client, url, jar) {
            return get(url + '/hello-world', { jar: jar });
          }).spread(function(res) {
            var userSession = JSON.parse(res.headers['x-user-session']);
            userSession.accessToken.should.eql('refresh-token');
          });
        });

        it('sets the new expiresIn', function() {
          return authenticate().spread(function(client, url, jar) {
            return get(url + '/hello-world', { jar: jar });
          }).spread(function(res) {
            var userSession = JSON.parse(res.headers['x-user-session']);
            userSession.expiresIn.should.eql(28800);
          });
        });
      });

      context('and userSession does not contain user info', function() {
        beforeEach(function(){
          herokuStubber.stubUser({ email: undefined });
        });

        it('forces to reauthenticate', function() {
          return withClient().spread(function(client, url) {
            return get(url, { followRedirect: false });
          }).spread(function(res) {
            res.headers.location.should.eql('/auth/heroku');
          });
        });
      });
    });

    context('and sessionSyncNonce is set', function() {
      var clientOptions, jar;

      beforeEach(function() {
        clientOptions = { sessionSyncNonce: 'my_session_nonce' };

        var cookie = new tough.Cookie({
          key  : 'my_session_nonce',
          value: 'my_session_nonce_value'
        });

        jar = httpUtils.jar();
        jar.setCookie(cookie, 'http://localhost');
      });

      it('adds a sessionSyncNonce to the session', function() {
        return authenticate(clientOptions, jar).spread(function(client, url) {
          return get(url + '/hello-world', { jar: jar });
        }).spread(function(res) {
          var session = JSON.parse(res.headers['x-session']);
          session.herokuBouncerSessionNonce.should.eql('my_session_nonce_value');
        });
      });

      context('and the sessionSyncNonce has changed', function() {
        var cookie;

        beforeEach(function() {
          cookie = new tough.Cookie({
            key  : 'my_session_nonce',
            value: 'my_new_session_nonce_value'
          });
        });

        it('clears the session', function() {
          return authenticate(clientOptions, jar).spread(function(client, url) {
            jar.setCookie(cookie, 'http://localhost');

            return get(url + '/hello-world', { jar: jar, followRedirect: false }).then(function() {
              return get(url + '/ignore', { jar: jar });
            });
          }).spread(function(res) {
            var session = JSON.parse(res.headers['x-session']);
            session.should.eql({ redirectPath: '/hello-world' });
          });
        });

        context('and it is a non-JSON GET request', function() {
          it('redirects the user to reauthenticate', function() {
            return authenticate(clientOptions, jar).spread(function(client, url) {
              jar.setCookie(cookie, 'http://localhost');
              return get(url + '/hello-world', { jar: jar, followRedirect: false });
            }).spread(function(res) {
              res.headers.location.should.eql('/auth/heroku');
            });
          });
        });

        context('and it is a non-GET request', function() {
          it('returns a 401', function() {
            return authenticate(clientOptions, jar).spread(function(client, url) {
              jar.setCookie(cookie, 'http://localhost');
              return post(url + '/hello-world', { jar: jar });
            }).spread(function(res) {
              res.statusCode.should.eql(401);
            });
          });

          it('returns an unauthorized message', function() {
            return authenticate(clientOptions, jar).spread(function(client, url) {
              jar.setCookie(cookie, 'http://localhost');
              return post(url + '/hello-world', { jar: jar });
            }).spread(function(res, body) {
              JSON.parse(body).should.eql({ id: 'unauthorized', message: 'Please authenticate.' });
            });
          });
        });

        context('and it is a JSON request', function() {
          it('returns a 401', function() {
            return authenticate(clientOptions, jar).spread(function(client, url) {
              jar.setCookie(cookie, 'http://localhost');
              return get(url + '/hello-world', { jar: jar, json: true });
            }).spread(function(res) {
              res.statusCode.should.eql(401);
            });
          });

          it('returns an unauthorized message', function() {
            return authenticate(clientOptions, jar).spread(function(client, url) {
              jar.setCookie(cookie, 'http://localhost');
              return get(url + '/hello-world', { jar: jar, json: true });
            }).spread(function(res, body) {
              body.should.eql({ id: 'unauthorized', message: 'Please authenticate.' });
            });
          });
        });
      });
    });

    context('and herokaiOnly is set', function() {
      var clientOptions;

      beforeEach(function() {
        clientOptions = { herokaiOnlyHandler: function(req, res) {
          res.end('You are not a Herokai.');
        } };
      });

      context('and the user is a Herokai', function() {
        it('performs the request like normal', function() {
          herokuStubber.stubUser({ email: 'user@heroku.com' });
          return itBehavesLikeANormalRequest(clientOptions);
        });
      });

      context('and the user is not a Herokai', function() {
        /*
         * Non-GET and JSON requests for non-Herokai are not tested, because a
         * session couldn't be established for them in the first place (since
         * sessions are cleared on every re-auth, they coudn't establish a
         * session with a GET first, and then do a POST with the same session).
         */
        context('and it is a non-JSON GET request', function() {
          it('uses the custom request handler', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return get(url, { jar: jar });
            }).spread(function(res, body) {
              body.should.eql('You are not a Herokai.');
            });
          });
        });
      });
    });
  });

  describe('logging out', function() {
    it('redirects to the logout path', function() {
      return authenticate().spread(function(client, url, jar) {
        return get(url + '/auth/heroku/logout', { jar: jar, followRedirect: false });
      }).spread(function(res) {
        // `client` is set in the scope of this module :\
        res.headers.location.should.eql('http://localhost:' + client.serverPort + '/logout');
      });
    });

    it('clears the session', function() {
      return authenticate().spread(function(client, url, jar) {
        return get(url + '/auth/heroku/logout', { jar: jar, followRedirect: false }).then(function() {
          return get(url + '/ignore', { jar: jar });
        });
      }).spread(function(res) {
        var session = JSON.parse(res.headers['x-session']);
        session.should.eql({});
      });
    });
  });

  describe('ignored routes', function() {
    context('when there is no user logged in', function() {
      it('ignores the specified routes', function() {
        return withClient().spread(function(client, url) {
          return get(url + '/ignore', { followRedirect: false });
        }).spread(function(res) {
          res.statusCode.should.eql(200);
        });
      });
    });

    context('when there is a user logged in', function() {
      it('uses its normal middleware', function() {
        return authenticate().spread(function(client, url, jar) {
          return get(url + '/token', { jar: jar });
        }).spread(function(res, body) {
          body.should.not.be.empty;
        });
      });
    });
  });

  describe('redirects', function() {
    context('when there is a redirect query param', function() {
      it('redirects', function() {
        return withClient().spread(function(client, url) {
          return get(url + '/auth/heroku?redirectPath=/hello-world', { jar: httpUtils.jar() });
        }).spread(function(res, body) {
          body.should.eql('hello world');
        });
      });
    });

    context('when there is a referer header', function() {
      it('redirects', function() {
        return withClient().spread(function(client, url) {
          return get(url + '/auth/heroku', { jar: httpUtils.jar(), headers: { referer: '/hello-world' } });
        }).spread(function(res, body) {
          body.should.eql('hello world');
        });
      });
    });
  });
});

function authenticate(clientOptions, jar) {
  return withClient(clientOptions).spread(function(client, url) {
    jar = jar || httpUtils.jar();

    return get(url, { jar: jar }).then(function() {
      return [client, url, jar];
    });
  });
}

function itBehavesLikeANormalRequest(clientOptions) {
  return authenticate(clientOptions).spread(function(client, url, jar) {
    return get(url + '/hello-world', { jar: jar });
  }).spread(function(res, body) {
    body.should.eql('hello world');
  });
}

function withClient(options) {
  options = options || {};

  return createClient(options).spread(function(_client, url) {
    client = _client;
    return [client, url];
  });
}
