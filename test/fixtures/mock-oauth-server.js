'use strict';

var bodyParser = require('body-parser');
var express    = require('express');
var http       = require('http');
var uuid       = require('node-uuid');
var app        = express();
var server     = http.createServer(app);

app.post('/oauth/token', bodyParser.urlencoded({ extended: false }), function(req, res) {
  if (req.body.grant_type === 'refresh_token') {
    res.end(JSON.stringify({
      access_token : 'refresh-token',
      refresh_token: uuid.v4(),
      expires_in   : 28800
    }));
  } else {
    res.end(JSON.stringify({
      access_token : 'original-token',
      refresh_token: uuid.v4(),
      expires_in   : 0
    }));
  }
});

app.get('/logout', function(req, res) {
  res.end('ok');
});

app.get('*', function(req, res) {
  res.redirect(callback(server.clientPort));
});

module.exports = server;

function callback(port) {
  return 'http://localhost:' + port + '/auth/heroku/callback?code=12345';
}
