'use strict';

var request      = require('request');
var should       = require('should');
var herokuStub   = require('./helpers/heroku');
var clientHelper = require('./helpers/client');
var shared       = require('./helpers/shared');
var reqHandler   = function(req, res, next) { res.end('custom handler'); };
var client;

describe('bouncer', function() {
  beforeEach(function(done) {
    clientHelper.createClient(this.clientOptions, function(err, newClient) {
      client = newClient;
      done();
    });
  });

  afterEach(function(done) {
    client.close(done);
  });

  describe('when not logged in', function() {
    it('redirects to /auth/heroku', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + client.address().port,
        followRedirect: false
      }, function(err, res) {
        if (err) throw err;

        res.headers['location'].should.eql('/auth/heroku')
        done();
      });
    });
  });

  describe('when logged in', function() {
    context('and herokaiOnly is not set', function() {
      it('does not redirect', function(done) {
        shared.shouldNotRedirect(client, done);
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

        it('does not redirect', function(done) {
          shared.shouldNotRedirect(client, done);
        });
      });

      context('and the user is not a herokai', function() {
        beforeEach(function() {
          herokuStub.stubUser({ email: 'user@example.com' });
        });

        context('and the request is an HTML GET', function() {
          it('does a redirect', function(done) {
            shared.shouldRedirect(client, done);
          });
        });

        context('and the request is a non-HTML GET', function() {
          var lastRes;

          beforeEach(function(done) {
            var jar = request.jar();

            request({
              jar: jar,
              url: 'http://localhost:' + client.address().port,
            }, function(err, res) {
              if (err) throw err;

              request({
                jar: jar,
                url: 'http://localhost:' + client.address().port + '/hello',
                headers: {
                  'content-type': 'application/json'
                },
                followRedirect: false
              }, function(err, res) {
                if (err) throw err;
                lastRes = res;
                done();
              });
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

          beforeEach(function(done) {
            var jar = request.jar();

            request({
              jar: jar,
              url: 'http://localhost:' + client.address().port,
            }, function(err, res) {
              if (err) throw err;

              request.post({
                jar: jar,
                url: 'http://localhost:' + client.address().port + '/hello',
                followRedirect: false
              }, function(err, res) {
                if (err) throw err;
                lastRes = res;
                done();
              });
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

        it('does not redirect', function(done) {
          shared.shouldNotRedirect(client, done);
        });
      });

      context('and the user is not a herokai', function() {
        var lastRes;

        beforeEach(function(done) {
          herokuStub.stubUser({ email: 'user@example.com' });

          var jar = request.jar();

          request({
            jar: jar,
            url: 'http://localhost:' + client.address().port,
          }, function(err, res) {
            if (err) throw err;

            request.post({
              jar: jar,
              url: 'http://localhost:' + client.address().port + '/hello',
              followRedirect: false
            }, function(err, res) {
              if (err) throw err;
              lastRes = res;
              done();
            });
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

    it('redirects to the ID logout path', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + client.address().port
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + client.address().port + '/auth/heroku/logout',
          followRedirect: false
        }, function(err, res) {
          if (err) throw err;

          res.headers['location'].should.eql('http://localhost:' + client.serverPort + '/logout');
          done();
        });
      });
    });

    it('nullifies the session', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + client.address().port
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + client.address().port + '/auth/heroku/logout'
        }, function(err, res) {
          if (err) throw err;

          var cookies = jar.getCookieString('http://localhost:' + client.address().port);
          should(cookies.match(/userSession/)).eql(null);
          done();
        });
      });
    });
  });

  describe('ignoring routes', function() {
    before(function() {
      this.clientOptions = null;
    });

    context('when there is no user session', function() {
      it('ignores specified routes', function(done) {
        request({
          url: 'http://localhost:' + client.address().port + '/ignore',
          followRedirect: false
        }, function(err, res) {
          if (err) throw err;

          res.body.should.eql('no redirect');
          done();
        });
      });
    });

    context('when there is a user session', function() {
      it('uses its normal middleware', function(done) {
        var jar = request.jar();

        request({
          jar: jar,
          url: 'http://localhost:' + client.address().port
        }, function(err, res) {
          if (err) throw err;

          request({
            jar: jar,
            url: 'http://localhost:' + client.address().port + '/ignore-with-session',
            followRedirect: false
          }, function(err, res) {
            if (err) throw err;

            res.body.should.eql('access_token');
            done();
          });
        });
      });
    });
  });
});
