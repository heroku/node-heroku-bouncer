'use strict';

var encryptor = require('simple-encryptor');
var axios     = require('axios');

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
      var isHerokai = /@heroku\.com$/.test(userSession.user.email);

      if (options.herokaiOnlyHandler && !isHerokai) {
        return options.herokaiOnlyHandler(req, res, next);
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
      var params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', userSession.refreshToken);
      params.append('client_secret', options.oAuthClientSecret);

      axios.post(options.oAuthServerURL + '/oauth/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: function() { return true; },
        responseType: 'json'
      }).then(function(response) {
        var res  = response;
        var body = response.data;

        if (res.status === 200) {
          userSession.accessToken  = body.access_token;
          userSession.refreshToken = body.refresh_token;
          userSession.createdAt    = (new Date()).toISOString();
          userSession.expiresIn    = body.expires_in;

          cb();
        } else {
          cb(new Error('Expected 200 from Heroku Identity, got ' + res.status));
        }
      }).catch(function(err) {
        cb(err);
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
