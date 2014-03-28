'use strict';

var express = require('express');
var http    = require('http');
var request = require('request');
var app     = express();
var server  = http.createServer(app);

app.post('/oauth/token', function(req, res) {
  res.end(JSON.stringify({ access_token: 'access_token' }));
});

app.get('*', function(req, res) {
  res.redirect(callback(server.clientPort));
});

module.exports = server;

function callback(port) {
  return 'http://localhost:' + port + '/auth/heroku/callback?code=12345';
}
