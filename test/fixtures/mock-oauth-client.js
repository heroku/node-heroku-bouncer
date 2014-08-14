'use strict';

var express = require('express');
var http    = require('http');

module.exports = function(options) {
  var app     = express();
  var server  = http.createServer(app);
  var bouncer = require('../../index')(options);
  var cipher  = require('simple-encryptor')('abcd1234abcd1234');

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

  app.use(function(req, res, next) {
    res.set('x-cookies', JSON.stringify(req.cookies));
    res.set('x-session', JSON.stringify(req.session));

    if (req.session.userSession) {
      res.set('x-user-session', JSON.stringify(cipher.decrypt(req.session.userSession)));
    }

    next();
  });

  app.get('/hello-world', function(req, res) {
    res.end('hello world');
  });

  app.get('/herokai-only', function(req, res) {
    res.end('herokai only');
  });

  app.get('/ignore', function(req, res) {
    res.end('no redirect');
  });

  app.get('/token', function(req, res) {
    res.end(req['heroku-bouncer'].token);
  });

  return server;
};
