'use strict';

var encryptor = require('simple-encryptor');
var request   = require('request');

/**
 * Middleware for using Heroku OAuth.
 *
 * @class Middleware
 */

/**
 * Create a piece of middleware for using Heroku OAuth. If the user is
 * authenticated, it will add appropriate account information and a token for
 * making API requests to the session.
 *
 * @method main
 * @private
 * @param {Object} options options for configuring the middleware. See
 *   {{#crossLink "Main/main"}}Main#main{{/crossLink}} for configuration
 *   details.
 * @return {Function} a piece of middleware
 */
module.exports = function(options) {
  var cipher = encryptor(options.encryptionSecret);

  return function(req, res, next) {
    var userSession = getUserSession(req, options.sessionSyncNonce);

    if (!userSession && isIgnoredRoute(req.path)) {
      return next();
    }

    if (userSession) {
      if (options.authCallback && !options.authCallback(userSession.user)) {
        if (options.authCallbackFailedHandler) {
          return options.authCallbackFailedHandler(req, res, next);
        } else {
          // FIXME: is this the right thing? Or a default 401?
          reauthenticate(req, res);
        }
      }

      ensureValidToken(userSession, function(err) {
        if (err) {
          return reauthenticate(req, res);
        }

        req.session.userSession = cipher.encrypt(userSession);

        req['heroku-bouncer'] = {
          token: userSession.accessToken,
          email: userSession.user.email,
          name : userSession.user.name,
          id   : userSession.user.id
        };

        next();
      });
    } else if (isOAuthPath(req.path)) {
      next();
    } else {
      reauthenticate(req, res);
    }
  };

  function ensureValidToken(userSession, cb) {
    var then      = new Date(userSession.createdAt);
    var now       = new Date();
    var remaining = (now - then) / 1000; // Remaining until token expires.
    remaining += 600; // Add 10 minutes

    if (remaining > userSession.expiresIn) {
      request.post({
        url : options.oAuthServerURL + '/oauth/token',
        json: true,
        form: {
          grant_type   : 'refresh_token',
          refresh_token: userSession.refreshToken,
          client_secret: options.oAuthClientSecret
        }
      }, function(err, res, body) {
        if (err) {
          return cb(err);
        }

        if (res.statusCode === 200) {
          userSession.accessToken  = body.access_token;
          userSession.refreshToken = body.refresh_token;
          userSession.createdAt    = (new Date()).toISOString();
          userSession.expiresIn    = body.expires_in;

          cb();
        } else {
          cb(new Error('Expected 200 from Heroku Identity, got ' + res.statusCode));
        }
      });
    } else {
      cb();
    }
  }

  function getUserSession(req, checkNonce) {
    var session = cipher.decrypt(req.session.userSession);

    if (checkNonce) {
      return nonceMatch(req, checkNonce) ? session : null;
    } else {
      return (session && session.user && session.user.email) ? session : null;
    }
  }

  function isIgnoredRoute(route) {
    var pattern;

    for (var i = 0; i < options.ignoredRoutes.length; i++) {
      pattern = options.ignoredRoutes[i];

      if (pattern.test(route)) {
        return true;
      }
    }
  }

  function reauthenticate(req, res) {
    var isJSON = /json/.test(req.get('accept'));

    req.session.reset();

    if (req.method.toLowerCase() === 'get' && !isJSON) {
      req.session.redirectPath = req.url;
      res.redirect('/auth/heroku');
    } else {
      res.statusCode = 401;
      res.json({ id: 'unauthorized', message: 'Please authenticate.' });
    }
  }
};

function nonceMatch(req, checkNonce) {
  return req.session.herokuBouncerSessionNonce === req.cookies[checkNonce];
}

function isOAuthPath(path) {
  return [
    '/auth/heroku',
    '/auth/heroku/callback'
  ].indexOf(path) >= 0;
}
