'use strict';

var encryptor = require('encryptor');
var express   = require('express');

module.exports = function(options) {
  var cipher = encryptor(options.herokuBouncerSecret);

  return function(req, res, next) {
    var i, route;

    for (i = 0; i < options.ignoreRoutes.length; i++) {
      route = options.ignoreRoutes[i];

      if (!req.session.userSession && req.url.match(route)) {
        return next();
      }
    }

    if (req.session.userSession || isOAuthPath(req.path)) {
      if (req.session.userSession) {
        var userSession = JSON.parse(cipher.decrypt(req.session.userSession));
        var token       = userSession.accessToken;
        var email       = userSession.user.email;

        if ((options.herokaiOnly === true) && (!isHerokai(email))){
          res.redirect(401, 'https://www.heroku.com');
        } else if ((typeof options.herokaiOnly === 'function') && (!isHerokai(email))) {
          options.herokaiOnly();
        }

        req['heroku-bouncer'] = {
          token: token,
          email: userSession.user.email,
          name : userSession.user.name
        };
      }

      next();
    } else {
      req.session.redirectPath = req.url;
      res.redirect('/auth/heroku');
    }
  };
};

function isHerokai(email) {
  var herokuEmail = '@heroku.com';
  return email.indexOf(herokuEmail, email.length - herokuEmail.length) !== -1;
}

function isOAuthPath(path) {
  return [
    '/auth/heroku',
    '/auth/heroku/callback'
  ].indexOf(path) >= 0;
}
