'use strict';

var express = require('express');

module.exports = express.cookieSession({
  secret: process.env.SESSION_SECRET,
  cookie: {
    path    : '/',
    signed  : true,
    httpOnly: true,
    maxAge  : null
  }
});
