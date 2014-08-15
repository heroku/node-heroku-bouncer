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
  var cipher = encryptor(options.sessionSecret);

  return function(req, res, next) {
    var currentSession = getCurrentSession(req, options.sessionSyncNonce);
    var route;

    if (!currentSession && isIgnoredRoute(req.path)) {
      return next();
    }

    if (currentSession || isOAuthPath(req.path)) {
      if (currentSession) {
        var userSession = cipher.decrypt(currentSession);
        var isHerokai   = /@heroku\.com$/.test(userSession.user.email);

        if (options.herokaiOnly === true && !isHerokai) {
          return reauthenticate(req, res, {
            redirectTo: options.herokaiOnlyRedirect,
            message   : 'This app is limited to Herokai only.'
          });
        } else if (typeof options.herokaiOnly === 'function' && !isHerokai) {
          return options.herokaiOnly(req, res, next);
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
      } else {
        next();
      }
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

  function isIgnoredRoute(route) {
    var pattern;

    for (var i = 0; i < options.ignoredRoutes.length; i++) {
      pattern = options.ignoredRoutes[i];

      if (pattern.test(route)) {
        return true;
      }
    }
  }

  function reauthenticate(req, res, options) {
    var isJSON = /json/.test(req.get('accept'));

    options = options || {};

    var redirectTo = options.redirectTo || '/auth/heroku';
    var message    = options.message || 'Please authenticate.';

    req.session.reset();

    if (req.method.toLowerCase() === 'get' && !isJSON) {
      if (redirectTo === '/auth/heroku') {
        req.session.redirectPath = req.url;
      }

      res.redirect(redirectTo);
    } else {
      res.statusCode = 401;
      res.json({ id: 'unauthorized', message: message });
    }
  }
};

function getCurrentSession(req, checkNonce) {
  var session = req.session.userSession;

  if (checkNonce) {
    return nonceMatch(req, checkNonce) ? session : null;
  } else {
    return session;
  }
}

function nonceMatch(req, checkNonce) {
  return req.session.herokuBouncerSessionNonce === req.cookies[checkNonce];
}

function isOAuthPath(path) {
  return [
    '/auth/heroku',
    '/auth/heroku/callback'
  ].indexOf(path) >= 0;
}
