'use strict';

// Preloaded (`node -r`) into child processes that run the bouncer. Any socket
// connection to a non-loopback host is refused and reported on stderr, so a
// test can never reach a real Heroku host and can assert that nothing tried.

var net = require('net');

var LOOPBACK = ['localhost', '127.0.0.1', '::1', '[::1]'];
var connect  = net.Socket.prototype.connect;

net.Socket.prototype.connect = function() {
  var args = Array.prototype.slice.call(arguments);
  var arg  = args[0];
  var host;

  if (Array.isArray(arg)) {
    arg = arg[0];
  }

  if (arg && typeof arg === 'object') {
    if (arg.path) {
      return connect.apply(this, args); // unix socket / IPC
    }
    host = arg.host || 'localhost';
  } else if (typeof arg === 'string' && isNaN(Number(arg))) {
    return connect.apply(this, args); // a path
  } else {
    host = typeof args[1] === 'string' ? args[1] : 'localhost';
  }

  if (LOOPBACK.indexOf(String(host).toLowerCase()) === -1) {
    process.stderr.write('BLOCKED_EXTERNAL_CONNECT ' + host + '\n');
    var self = this;
    process.nextTick(function() {
      self.destroy(new Error('Blocked connection to non-loopback host ' + host));
    });
    return this;
  }

  return connect.apply(this, args);
};
