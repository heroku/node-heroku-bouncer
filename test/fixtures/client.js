'use strict';

var express = require('express');
var http    = require('http');
var app     = express();
var server  = http.createServer(app);

module.exports = function(serverPort) {
  var bouncer = require('../../index')({
    herokuOAuthID      : 'client-id',
    herokuOAuthSecret  : 'client-secret',
    herokuBouncerSecret: 'bouncer-secret',
    herokuAuthURL      : 'http://localhost:' + serverPort
  });

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

  return server;
}
