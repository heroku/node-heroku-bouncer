'use strict';

var OAuth         = require('oauth').OAuth2;
var encryptor     = require('encryptor')(process.env.ENCRYPTION_SECRET);
var express       = require('express');
var cookieSession = require('./lib/cookie-session');

module.exports = function bouncer(app) {
  app.use(express.cookieParser(process.env.COOKIE_SECRET));

  app.use(cookieSession);

  app.use(function(req, res, next) {
    if (req.session.userSession) {
      var userSession = JSON.parse(encryptor.decrypt(req.session.userSession));
      var token       = userSession.accessToken;

      req['heroku-bouncer'] = {
        token: token
      }
    }

    next();
  });

  app.get('/auth/heroku', function(req, res) {
    var oauth = getOAuth();
    res.redirect(oauth.getAuthorizeUrl({ response_type: 'code' }));
  });

  app.get('/auth/heroku/callback', function(req, res) {
    var oauth = getOAuth();

    oauth.getOAuthAccessToken(req.query.code, null, function(err, accessToken) {
      if (err) {
        return res.redirect('/auth/heroku');
      }

      var userSession = JSON.stringify({ accessToken: accessToken });
      var redirectPath;

      req.session.userSession = encryptor.encrypt(userSession);

      if (!req.session.redirectPath) {
        redirectPath = '/';
      } else {
        redirectPath = req.session.redirectPath;
      }

      req.session.redirectPath = null;
      res.redirect(redirectPath);
    });
  });

  app.get('/auth/heroku/logout', function(req, res) {
    req.session = null;
    res.redirect(process.env.HEROKU_AUTH_URL + '/logout');
  });
};

function getOAuth() {
  return new OAuth(
    process.env.HEROKU_OAUTH_ID,
    process.env.HEROKU_OAUTH_SECRET,
    process.env.HEROKU_AUTH_URL,
    '/oauth/authorize',
    '/oauth/token'
  );
}
