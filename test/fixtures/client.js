'use strict';

var express  = require('express');
var http     = require('http');

module.exports = function(options) {
  var app     = express();
  var server  = http.createServer(app);
  var bouncer = require('../../index')(options);

  app.use(require('cookie-parser')('cookie secret'));

  app.use(require('client-sessions')({
    cookieName: 'session',
    secret: 'cookie session secret',
    cookie: {
      path: '/',
      httpOnly: true,
      secure: false
    }
  }));

  app.use(bouncer.middleware);
  app.use(bouncer.router);

  app.get('/session', function(req, res) {
    res.json(req.session);
  });

  app.get('/hello', function(req, res) {
    res.end('hello world');
  });

  app.get('/ignore', function(req, res) {
    res.end('no redirect');
  });

  app.get('/ignore-with-session', function(req, res) {
    res.end(req['heroku-bouncer'].token);
  });

  return server;
};
