'use strict';

var express = require('express');
var http    = require('http');

module.exports = function(options) {
  var app     = express();
  var server  = http.createServer(app);
  var bouncer = require('../../index')(options);

  app.use(express.cookieParser('cookie secret'));

  app.use(express.cookieSession({
    secret: 'cookie session secret',
    cookie: {
      path    : '/',
      signed  : true,
      httpOnly: true,
      maxAge  : null
    }
  }));

  app.use(bouncer.middleware);
  app.use(bouncer.router);

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
}
