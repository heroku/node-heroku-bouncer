'use strict';

var request = require('request');
var should  = require('should');

describe('bouncer', function() {
  var herokuStub = require('./helpers/heroku');
  var client     = require('./helpers/client');
  client.boot(0);

  describe('when not logged in', function() {
    context('when user is herokai', function(){
      beforeEach(function() {
        herokuStub.stubUser("herokai@heroku.com");
      });

      context('and herokaiOnly is true', function(){
        // client.boot({ herokaiOnly: true });
        // client.kill();
      });

      context('and herokaiOnly is false', function(){
        // client.boot({ herokaiOnly: false });
        // client.kill();
      });

      context('and herokaiOnly is a request handler', function(){
        // client.boot({ herokaiOnly: function(req, res, next) { res.end('ok'); } });
        // client.kill();
      });
    });

    context('when user is not herokai', function(){
      beforeEach(function() {
        herokuStub.stubUser("user@email.com");
      });

      context('and herokaiOnly is true', function(){
        // client.boot({ herokaiOnly: true });
        // client.kill();
      });

      context('and herokaiOnly is false', function(){
        // client.boot({ herokaiOnly: false });
        // client.kill();
      });

      context('and herokaiOnly is a request handler', function(){
        // client.boot({ herokaiOnly: function(req, res, next) { res.end('ok'); } });
        // client.kill();
      });
    });

    // client.boot();

    it('redirects to /auth/heroku', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + client.port(),
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
        url: 'http://localhost:' + client.port() + '/hello'
      }, function(err, res) {
        if (err) throw err;

        res.body.should.eql('hello world');
        done();
      });
    });

    // client.kill();

  });

  describe('when logged in', function() {
    // client.boot();

    it('does not redirect', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + client.port()
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + client.port() + '/hello',
          followRedirect: false
        }, function(err, res) {
          if (err) throw err;

          res.body.should.eql('hello world');
          done();
        });
      });
    });

    // client.kill();
  });

  describe('logging out', function() {
    // client.boot();

    it('redirects to the ID logout path', function(done) {
      request({
        jar: true,
        url: 'http://localhost:' + client.port() + '/auth/heroku/logout',
        followRedirect: false
      }, function(err, res) {
        if (err) throw err;

        res.headers['location'].should.eql('http://localhost:' + client.serverPort() + '/logout');
        done();
      });
    });

    it('nullifies the session', function(done) {
      var jar = request.jar();

      request({
        jar: jar,
        url: 'http://localhost:' + client.port()
      }, function(err, res) {
        if (err) throw err;

        request({
          jar: jar,
          url: 'http://localhost:' + client.port() + '/auth/heroku/logout'
        }, function(err, res) {
          if (err) throw err;

          var cookies = jar.getCookieString('http://localhost:' + client.port());
          should(cookies.match(/userSession/)).eql(null);
          done();
        });
      });
    });

    // client.kill();

  });

  describe('ignoring routes', function() {
    // client.boot();

    context('when there is no user session', function() {
      it('ignores specified routes', function(done) {
        request({
          url: 'http://localhost:' + client.port() + '/ignore',
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
          url: 'http://localhost:' + client.port()
        }, function(err, res) {
          if (err) throw err;

          request({
            jar: jar,
            url: 'http://localhost:' + client.port() + '/ignore-with-session',
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
