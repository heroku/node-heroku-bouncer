'use strict';

var express = require('express');
var http    = require('http');

module.exports = function(options) {
  var app     = express();
  var server  = http.createServer(app);
  var bouncer = require('../../index')(options);
  var cipher  = require('encryptor')('bouncer-secret');

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
      res.set('x-user-session', cipher.decrypt(req.session.userSession));
    }

    next();
  });

  app.get('/session', function(req, res) {
    res.json(req.session);
  });

  app.get('/hello-world', function(req, res) {
    res.end('hello world');
  });

  app.get('/ignore', function(req, res) {
    res.end('no redirect');
  });

  app.get('/token', function(req, res) {
    res.end(req['heroku-bouncer'].token);
  });

  return server;
};
