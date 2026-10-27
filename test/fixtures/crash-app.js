'use strict';

// A minimal host app that mounts the bouncer the way hc-support and
// hc-dashboard do: no uncaughtException handler, default Express error
// handling. Started as a child process by test/callback-errors-test.js so a
// crash shows up as a real process exit.
//
// Usage: node crash-app.js '<json options for the bouncer>'
// Prints `LISTENING <port>` on stdout once it is accepting connections.

var express = require('express');
var options = JSON.parse(process.argv[2]);

var app = express();

app.use(require('cookie-parser')('cookie secret'));
app.use(require('client-sessions')({
  cookieName: 'session',
  secret    : 'cookie session secret',
  cookie    : { path: '/', httpOnly: true, secure: false }
}));

options.ignoredRoutes = [/^\/healthz/];
app.use(require('../../index')(options));

app.get('/healthz', function(req, res) {
  res.end('ok');
});

app.get('/hello-world', function(req, res) {
  res.end('hello world');
});

var server = app.listen(0, '127.0.0.1', function() {
  process.stdout.write('LISTENING ' + server.address().port + '\n');
});
