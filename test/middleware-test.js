'use strict';

var request    = require('request');
var should     = require('should');

describe('bouncer', function() {
  var server = require('./fixtures/server');
  server.listen(0);
  var serverPort = server.address().port;

  var client = require('./fixtures/client')(server.address().port);
  client.listen(0);
  var clientPort = client.address().port;

  server.clientPort = clientPort;

  describe('when not logged in', function() {
    it('redirects to /auth/heroku', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + clientPort,
        followRedirect: false
      }, function(err, res) {
        if (err) throw err;

        res.headers['location'].should.eql('/auth/heroku')
        done();
      });
    });

    it('redirects back to the requested path', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + clientPort + '/hello'
      }, function(err, res) {
        if (err) throw err;

        res.body.should.eql('hello world');
        done();
      });
    });
  });

  describe('when logged in', function() {
    it('does not redirect', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + clientPort
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + clientPort + '/hello',
          followRedirect: false
        }, function(err, res) {
          if (err) throw err;

          res.body.should.eql('hello world');
          done();
        });
      });
    });
  });

  describe('logging out', function() {
    it('redirects to the ID logout path', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + clientPort + '/auth/heroku/logout',
        followRedirect: false
      }, function(err, res) {
        if (err) throw err;

        res.headers['location'].should.eql('http://localhost:' + serverPort + '/logout');
        done();
      });
    });

    it('nullifies the session', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + clientPort
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + clientPort + '/auth/heroku/logout'
        }, function(err, res) {
          if (err) throw err;

          var cookies = jar.getCookieString('http://localhost:' + clientPort);
          should(cookies.match(/userSession/)).eql(null);
          done();
        });
      });
    });
  });

  describe('ignoring routes', function() {
    context('when there is no user session', function() {
      it('ignores specified routes', function(done) {
        request({
          url: 'http://localhost:' + clientPort + '/ignore',
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
          url: 'http://localhost:' + clientPort
        }, function(err, res) {
          if (err) throw err;

          request({
            jar: jar,
            url: 'http://localhost:' + clientPort + '/ignore-with-session',
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
