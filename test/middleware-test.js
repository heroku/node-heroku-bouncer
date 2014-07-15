'use strict';

var Promise           = require('bluebird');
var request           = require('request');
var should            = require('should');
var herokuStub        = require('./helpers/heroku');
var clientHelper      = require('./helpers/client');
var shared            = require('./helpers/shared');
var get               = Promise.promisify(request.get);
var post              = Promise.promisify(request.post);
var reqHandler        = function(req, res) { res.end('custom handler'); };
var client;

describe('bouncer', function() {
  var shouldNotRedirect, shouldRedirect;

  before(function() {
    shouldNotRedirect = shared.shouldNotRedirect.bind(this);
    shouldRedirect    = shared.shouldRedirect.bind(this);
  });

  beforeEach(function(done) {
    clientHelper.createClient(this.clientOptions, function(err, newClient) {
      this.url = 'http://localhost:' + newClient.address().port;
      client   = newClient;
      done();
    }.bind(this));
  });

  afterEach(function(done) {
    client.close(done);
  });

  describe('when not logged in', function() {
    it('redirects to /auth/heroku', function() {
      return get({
        jar           : true,
        url           : this.url,
        followRedirect: false
      }).spread(function(res) {
        res.headers.location.should.eql('/auth/heroku');
      });
    });
  });

  describe('when logged in', function() {
    context('and herokaiOnly is not set', function() {
      it('does not redirect', function() {
        return shouldNotRedirect(client);
      });
    });

    context('and herokaiOnly is true', function() {
      before(function() {
        this.clientOptions = { herokaiOnly: true };
      });

      context('and the user is a herokai', function() {
        beforeEach(function() {
          herokuStub.stubUser({ email: 'user@heroku.com' });
        });

        it('does not redirect', function() {
          return shouldNotRedirect(client);
        });
      });

      context('and the user is not a herokai', function() {
        beforeEach(function() {
          herokuStub.stubUser({ email: 'user@example.com' });
        });

        context('and the request is an HTML GET', function() {
          it('does a redirect', function() {
            return shouldRedirect(client);
          });
        });

        context('and the request is a non-HTML GET', function() {
          var lastRes;

          beforeEach(function() {
            var jar = request.jar();

            return get({
              jar: jar,
              url: this.url
            }).then(function() {
              return get({
                jar           : jar,
                url           : this.url + '/hello',
                followRedirect: false,
                headers       : {
                  'content-type': 'application/json'
                }
              });
            }.bind(this)).spread(function(res) {
              lastRes = res;
            });
          });

          it('returns a 401', function() {
            lastRes.statusCode.should.eql(401);
          });

          it('returns an unauthorized message', function() {
            JSON.parse(lastRes.body).should.eql({ id: 'unauthorized', message: 'This app is limited to Herokai only.' });
          });
        });

        context('and the request is not a GET', function() {
          var lastRes;

          beforeEach(function() {
            var jar = request.jar();

            return get({
              jar: jar,
              url: this.url
            }).then(function() {
              return post({
                jar           : jar,
                url           : this.url + '/hello',
                followRedirect: false
              });
            }.bind(this)).spread(function(res) {
              lastRes = res;
            });
          });

          it('returns a 401', function() {
            lastRes.statusCode.should.eql(401);
          });

          it('returns an unauthorized message', function() {
            JSON.parse(lastRes.body).should.eql({ id: 'unauthorized', message: 'This app is limited to Herokai only.' });
          });
        });
      });
    });

    context('and herokaiOnly is a function', function() {
      before(function() {
        this.clientOptions = { herokaiOnly: reqHandler };
      });

      context('and the user is a herokai', function() {
        beforeEach(function() {
          herokuStub.stubUser({ email: 'user@heroku.com' });
        });

        it('does not redirect', function() {
          return shouldNotRedirect(client);
        });
      });

      context('and the user is not a herokai', function() {
        var lastRes;

        beforeEach(function() {
          herokuStub.stubUser({ email: 'user@example.com' });

          var jar = request.jar();

          return get({
            jar: jar,
            url: this.url
          }).then(function() {
            return post({
              jar           : jar,
              url           : this.url + '/hello',
              followRedirect: false
            });
          }.bind(this)).spread(function(res) {
            lastRes = res;
          });
        });

        it('calls the request handler', function() {
          lastRes.body.should.eql('custom handler');
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
      });
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
        var cookies = jar.getCookieString(this.url);
        should(cookies.match(/userSession/)).eql(null);
      }.bind(this));
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
            url           : this.url + '/ignore-with-session',
            followRedirect: false
          });
        }.bind(this)).spread(function(res) {
          res.body.should.eql('access_token');
        });
      });
    });
  });
});
