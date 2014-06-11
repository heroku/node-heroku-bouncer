'use strict';

var Heroku      = require('heroku-client');
var defaultUser = { email: 'user@example.com', name: 'Jane Smith' };
var currentUser = defaultUser;

Heroku.prototype.account = function() {
  return {
    info: function(cb) {
      process.nextTick(function() {
        cb(null, currentUser);
      });
    }
  };
};

exports.stubUser = function(user) {
  currentUser = user;
};

exports.reset = function() {
  currentUser = defaultUser;
};
