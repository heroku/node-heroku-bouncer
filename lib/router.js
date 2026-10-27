'use strict';

/**
 * @class Router
 */

var OAuth     = require('oauth').OAuth2;
var encryptor = require('simple-encryptor');
var express   = require('express');
var heroku    = require('heroku-client');

/**
 * Create a router with the necessary routes for Heroku OAuth authentication.
 *
 * @method main
 * @param {Object} options options for configuring the router. See
 *   {{#crossLink "Main/main"}}Main#main{{/crossLink}} for configuration
 *   details.
 * @return {Express.Router} an Express.js router
 */
module.exports = function(options) {
  var cipher = encryptor(options.encryptionSecret);
  var oauth  = getOAuth();
  var router = new express.Router();

  router.get('/auth/heroku', function(req, res) {
    var param = req.query.redirectPath;
    var path  = param || req.headers.referer;

    if (!req.session.redirectPath) {
      req.session.redirectPath = path;
    }

    var params = { response_type: 'code', scope: options.oAuthScope };
    if (options.oAuthState) {
      params.state = typeof options.oAuthState === 'function' ? options.oAuthState() : options.oAuthState;
    }
    res.redirect(oauth.getAuthorizeUrl(params));
  });

  router.get('/auth/heroku/callback', function(req, res, next) {
    oauth.getOAuthAccessToken(req.query.code, null, function(err, accessToken, refreshToken, results) {
      // These callbacks run outside of Express's synchronous error handling, so
      // throwing here would be an uncaught exception that kills the process.
      if (err || !accessToken) {
        // A 4xx from the identity server means it rejected the code (bad,
        // expired or reused); anything else is an upstream or connection failure.
        var rejected = err && err.statusCode >= 400 && err.statusCode < 500;
        return next(rejected ?
          httpError(401, 'Unable to authenticate with Heroku') :
          httpError(502, 'Unable to complete authentication with Heroku'));
      }

      var hk = heroku.createClient({
        token: accessToken,
        host : options.herokuAPIHost
      });

      hk.account().info(function(err, account) {
        if (err || !account) {
          return next(httpError(502, 'Unable to fetch Heroku account information'));
        }

        var userSession = {
          accessToken : accessToken,
          refreshToken: refreshToken,
          createdAt   : (new Date()).toISOString(),
          expiresIn   : results.expires_in,

          user: {
            name : account.name,
            email: account.email,
            id   : account.id
          }
        };

        // function that handles the physical redirect.
        function handleRedirect() {
          var redirectPath;

          if (options.sessionSyncNonce) {
            var nonceName = options.sessionSyncNonce;
            req.session.herokuBouncerSessionNonce = req.cookies[nonceName];
          }

          req.session.userSession = cipher.encrypt(userSession);

          if (!req.session.redirectPath || req.path === '/auth/heroku') {
            redirectPath = '/';
          } else {
            redirectPath = req.session.redirectPath;
          }

          delete req.session.redirectPath;
          res.redirect(redirectPath);
        }

        // optional callback to signal a new session was created
        if (options.newSessionCallback) {
          options.newSessionCallback(accessToken, refreshToken)
          .then(function () {
            handleRedirect();
          })
          .catch(function(err) {
            // TODO cleanup error handling
            console.log('Error from newSessionCallback' + err.toString());
            res.status(502).send('Unexpected response.  Status: ' + err.__statusCode +
                                    ', Response: ' + (err.__response ? err.__response : '-') +
                                    ', Exception msg: ' + err.toString() +
                                    ', Headers: ' + JSON.stringify(err.__headers));
          });
        }
        else {
          handleRedirect();
        }
      });
    });
  });

  router.get('/auth/heroku/logout', function(req, res) {
    req.session.reset();
    res.redirect(options.oAuthServerURL + '/logout');
  });

  // Build the error handed to Express. The upstream error (an identity server
  // response or a socket error) can carry response bodies, so none of it is
  // copied into the message or onto the error.
  function httpError(status, message) {
    var error = new Error(message);
    error.status = error.statusCode = status;
    return error;
  }

  function getOAuth() {
    return new OAuth(
      options.oAuthClientID,
      options.oAuthClientSecret,
      options.oAuthServerURL,
      '/oauth/authorize',
      '/oauth/token'
    );
  }

  return router;
};
