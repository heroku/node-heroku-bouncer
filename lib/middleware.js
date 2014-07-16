'use strict';

var encryptor = require('encryptor');
var request   = require('request');

/**
 * Middleware for using Heroku OAuth.
 *
 * @class Middleware
 */

/**
 * Create a middleware function for using Heroku OAuth. If the user is
 * authenticated, it will add an API token, email, name and ID to the user's
 * request and session.
 *
 * @method main
 * @param {Object} options options for configuring the middleware. See
 *   {{#crossLink "Main/main"}}Main#main{{/crossLink}} for configuration
 *   details.
 * @return {Function} a middleware function
 */
module.exports = function(options) {
  var cipher = encryptor(options.herokuBouncerSecret);

  return function(req, res, next) {
    var currentSession = getCurrentSession(req, options.sessionSyncNonce);
    var isJSON         = /json/.test(req.get('accept'));
    var i, route;

    for (i = 0; i < options.ignoreRoutes.length; i++) {
      route = options.ignoreRoutes[i];

      if (!currentSession && req.url.match(route)) {
        return next();
      }
    }

    if (currentSession || isOAuthPath(req.path)) {
      if (currentSession) {
        var userSession = JSON.parse(cipher.decrypt(currentSession));
        var isHerokai   = /@heroku\.com$/.test(userSession.user.email);

        if (options.herokaiOnly === true && !isHerokai) {
          if (isJSON || req.method !== 'GET') {
            res.statusCode = 401;
            return res.json({ id: 'unauthorized', message: 'This app is limited to Herokai only.' });
          } else {
            return res.redirect('https://www.heroku.com');
          }
        } else if (typeof options.herokaiOnly === 'function' && !isHerokai) {
          return options.herokaiOnly(req, res, next);
        }

        ensureValidToken(userSession, function(err) {
          if (err) {
            if (isJSON || req.method !== 'GET') {
              res.statusCode = 401;
              req.session.reset();
              return res.json({ id: 'unauthorized', message: 'Your session could not be refreshed. Please reauthenticate.' });
            } else {
              return res.redirect('/auth/heroku/logout');
            }
          }

          req.session.userSession = cipher.encrypt(JSON.stringify(userSession));

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
      if (req.method.toLowerCase() === 'get' && !isJSON) {
        req.session.redirectPath = req.url;
        res.redirect('/auth/heroku');
      } else {
        res.statusCode = 401;
        res.json({ id: 'unauthorized', message: 'Please authenticate.' });
      }
    }
  };

  function ensureValidToken(userSession, cb) {
    var then      = new Date(userSession.createdAt);
    var now       = new Date();
    var remaining = (now - then) / 1000; // Remaining until token expires.
    remaining += 600; // Add 10 minutes

    if (remaining > userSession.expiresIn) {
      request.post({
        url : options.herokuAuthURL + '/oauth/token',
        json: true,
        form: {
          grant_type   : 'refresh_token',
          refresh_token: userSession.refreshToken,
          client_secret: options.herokuOAuthSecret
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
