'use strict';

var express    = require('express');
var middleware = require('./lib/middleware');
var routes     = require('./lib/router');

/**
 * `heroku-bouncer` provides a router and a piece of middleware for handling
 * Heroku OAuth sessions in a web app.
 *
 *     var bouncer = require('heroku-bouncer')({
 *       encryptionSecret : process.env.USER_SESSION_SECRET,
 *       oAuthClientID    : process.env.HEROKU_OAUTH_ID,
 *       oAuthClientSecret: process.env.HEROKU_OAUTH_SECRET
 *     });
 *
 *     app.use(bouncer);
 *
 * @class Main
 */

/**
 * @method main
 * @param {Object} options
 * @param {String} options.encryptionSecret a user information encryption secret
 * @param {String} options.oAuthClientID a Heroku OAuth client ID
 * @param {String} options.oAuthClientSecret a Heroku OAuth client secret
 * @param {String} [options.sessionSyncNonce=null] the name of a cookie shared
 *   across different apps on the same domain to keep sessions synchronized
 * @param {Array} [options.ignoredRoutes=[] an array of regular expressions
 *   against which routes are tested to determine if they skip the
 *   authentication stack. Only used when there is no current session.
 * @param {String} [options.oAuthServerURL='https://id.heroku.com'] the URL of
 *   the Heroku OAuth server app
 * @param {Function} [options.herokaiOnlyHandler=null] if provided, this route
 *   handler will be called on requests by non-Herokai
 * ```
 */
module.exports = function(options) {
  var router = new express.Router();

  options = options || {};
  setOptions(options);

  router.middleware = middleware(options);
  router.router     = routes(options);
  router.use(router.middleware);
  router.use(router.router);

  return router;
};

function setOptions(options) {
  if (!options.encryptionSecret) {
    throw new Error('No `encryptionSecret` provided to heroku-bouncer');
  }

  if (!options.oAuthClientID) {
    throw new Error('No `oAuthClientID` provided to heroku-bouncer');
  }

  if (!options.oAuthClientSecret) {
    throw new Error('No `oAuthClientSecret` provided to heroku-bouncer');
  }

  if (options.herokaiOnlyHandler && typeof(options.herokaiOnlyHandler) !== 'function') {
    throw new Error('`herokaiOnlyHandler` must be a handler function');
  }

  var defaults = {
    herokaiOnly     : null,
    oAuthServerURL  : 'https: //id.heroku.com',
    ignoredRoutes   : [],
    sessionSyncNonce: null
  };

  for (var key in defaults) {
    if (defaults.hasOwnProperty(key)) {
      options[key] = options[key] || defaults[key];
    }
  }
}
