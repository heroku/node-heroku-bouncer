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
        var isHerokai   = /@heroku\.com$/.test(userSession.user.email);

        console.log(options.herokaiOnly, userSession.user.email);
        if ((options.herokaiOnly === true) && (!isHerokai)){
          // If I do `res.redirect` (no return):
          // Error: Can't set headers after they are sent.
          // at ServerResponse.OutgoingMessage.setHeader (http.js:691:11)
          // I think it's due to next(); line 43
          return res.redirect('https://www.heroku.com');
        } else if ((typeof options.herokaiOnly === 'function') && (!isHerokai)) {
          options.herokaiOnly(req, res, next);
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

function isOAuthPath(path) {
  return [
    '/auth/heroku',
    '/auth/heroku/callback'
  ].indexOf(path) >= 0;
}
