'use strict';

var OAuth     = require('oauth').OAuth2;
var encryptor = require('encryptor');
var express   = require('express');
var heroku    = require('heroku-client');
var router    = new express.Router();

module.exports = function(options) {
  var cipher = encryptor(options.herokuBouncerSecret);
  var oauth  = getOAuth();

  router.get('/auth/heroku', function(req, res) {
    res.redirect(oauth.getAuthorizeUrl({ response_type: 'code' }));
  });

  router.get('/auth/heroku/callback', function(req, res) {
    oauth.getOAuthAccessToken(req.query.code, null, function(err, accessToken) {
      if (err) throw err;

      var hk = heroku.createClient({ token: accessToken });

      hk.account().info(function(err, account) {
        if (err) throw err;

        var userSession = JSON.stringify({
          accessToken: accessToken,

          user: {
            name : account.name,
            email: account.email
          }
        });

        var redirectPath;

        req.session.userSession = cipher.encrypt(userSession);

        if (!req.session.redirectPath || req.path === '/auth/heroku') {
          redirectPath = '/';
        } else {
          redirectPath = req.session.redirectPath;
        }

        delete req.session.redirectPath;
        res.redirect(redirectPath);
      });
    });
  });

  router.get('/auth/heroku/logout', function(req, res) {
    req.session = null;
    res.redirect(options.herokuAuthURL + '/logout');
  });

  function getOAuth() {
    return new OAuth(
      options.herokuOAuthID,
      options.herokuOAuthSecret,
      options.herokuAuthURL,
      '/oauth/authorize',
      '/oauth/token'
    );
  }

  return router.middleware;
};
