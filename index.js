'use strict';

var OAuth         = require('oauth').OAuth2;
var encryptor     = require('encryptor')(process.env.ENCRYPTION_SECRET);
var express       = require('express');
var cookieSession = require('./lib/cookie-session');

module.exports = function bouncer(app) {
  app.use(express.cookieParser(process.env.COOKIE_SECRET));

  app.use(cookieSession);

  app.use(function(req, res, next) {
    if (req.session.userSession || isOAuthPath(req.path)) {
      if (req.session.userSession) {
        var userSession = JSON.parse(encryptor.decrypt(req.session.userSession));
        var token       = userSession.accessToken;

        req['heroku-bouncer'] = {
          token: token
        }
      }

      next();
    } else {
      req.session.redirectPath = req.url;
      res.redirect('/auth/heroku');
    }
  });

  app.get('/auth/heroku', function(req, res) {
    var oauth = getOAuth();
    res.redirect(oauth.getAuthorizeUrl({ response_type: 'code' }));
  });

  app.get('/auth/heroku/callback', function(req, res) {
    var oauth = getOAuth();

    oauth.getOAuthAccessToken(req.query.code, null, function(err, accessToken) {
      if (err) {
        return res.redirect('/login');
      }

      var userSession = JSON.stringify({ accessToken: accessToken });
      var redirectPath;

      req.session.userSession = encryptor.encrypt(userSession);

      if (!req.session.redirectPath || isLoginPath(req.path)) {
        redirectPath = '/';
      } else {
        redirectPath = req.session.redirectPath;
      }

      req.session.redirectPath = null;
      res.redirect(redirectPath);
    });
  });

  app.get('/logout', function(req, res) {
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

function isLoginPath(path) {
  return [
    '/auth/heroku',
    '/login'
  ].indexOf(path) >= 0;
}

function isOAuthPath(path) {
  return [
    '/auth/heroku',
    '/auth/heroku/callback',
    '/login'
  ].indexOf(path) >= 0;
}
