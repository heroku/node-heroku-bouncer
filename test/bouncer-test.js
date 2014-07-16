// jshint -W030

'use strict';

require('should');
require('./test-helper');

var Promise       = require('bluebird');
var request       = require('request');
var createClient  = require('./helpers/create-client');
var herokuStubber = require('./helpers/heroku');
var get           = Promise.promisify(request.get);
var post          = Promise.promisify(request.post);
var client;

describe('bouncer', function() {
  afterEach(function() {
    return new Promise(function(resolve, reject) {
      if (client.address()) {
        client.close(resolve)
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
    context('and sessionSyncNonce is set', function() {
      var clientOptions;

      beforeEach(function() {
        clientOptions = { sessionSyncNonce: 'my_session_nonce' };
      });
    });

    context('and herokaiOnly is set to `false`', function() {
      it('performs the request like normal', function() {
        return itBehavesLikeANormalRequest({ herokaiOnly: false });
      });
    });

    context('and herokaiOnly is set to `true`', function() {
      var clientOptions;

      beforeEach(function() {
        clientOptions = { herokaiOnly: true };
      });

      context('and the user is a Herokai', function() {
        it('performs the request like normal', function() {
          herokuStubber.stubUser({ email: 'user@heroku.com' });
          return itBehavesLikeANormalRequest(clientOptions);
        });
      });

      context('and the user is not a Herokai', function() {
        context('and it is a non-JSON GET request', function() {
          it('redirects to the Heroku website', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return get(url + '/hello-world', { jar: jar, followRedirect: false });
            }).spread(function(res) {
              res.headers.location.should.eql('https://www.heroku.com');
            });
          });
        });

        context('and it is a non-GET request', function() {
          it('returns a 401', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return post(url, { jar: jar });
            }).spread(function(res) {
              res.statusCode.should.eql(401);
            });
          });

          it('returns a non-Herokai message', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return post(url, { jar: jar });
            }).spread(function(res, body) {
              JSON.parse(body).should.eql({ id: 'unauthorized', message: 'This app is limited to Herokai only.' });
            });
          });
        });

        context('and it is a JSON request', function() {
          it('returns a 401', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return get(url, { jar: jar, json: true });
            }).spread(function(res) {
              res.statusCode.should.eql(401);
            });
          });

          it('returns a non-Herokai message', function() {
            return authenticate(clientOptions).spread(function(client, url, jar) {
              return get(url, { jar: jar, json: true });
            }).spread(function(res, body) {
              body.should.eql({ id: 'unauthorized', message: 'This app is limited to Herokai only.' });
            });
          });
        });
      });
    });

    context('and herokaiOnly is a function', function() {
      var clientOptions;

      beforeEach(function() {
        clientOptions = { herokaiOnly: function(req, res) {
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

function authenticate(clientOptions) {
  return withClient(clientOptions).spread(function(client, url) {
    var jar = request.jar();

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
