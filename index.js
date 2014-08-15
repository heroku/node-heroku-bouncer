'use strict';

var express    = require('express');
var middleware = require('./lib/middleware');
var routes     = require('./lib/router');

/**
 * `heroku-bouncer` is a function which exposes two things: A piece of
 * middleware to handle Heroku OAuth for a node app, and a router which exposes
 * the required OAuth endpoints (such as a callback URL), and a logout path.
 *
 * @class Main
 */

/**
 * @method main
 * @param {Object} options
 * @param {String} options.herokuBouncerSecret a secret used to encrypt
 *   information in the session
 * @param {String} options.herokuOAuthID an ID for a Heroku OAuth client
 * @param {String} options.herokuOAuthSecret a secret for a Heroku OAuth client
 * @param {String} [options.herokaiOnlyRedirect='https://www.heroku.com'] a URL
 *   to redirect to when a user is not a Herokai and `herokaiOnly` is `true`
 * @param {String} [options.sessionSyncNonce] if present, determines the name of
 *   a cookie shared across properties under the same domain in order to keep
 *   their sessions synchronized
 * @param {Array} [options.ignoreRoutes=[]] an array of route regular
 *   expressions to match request routes again. If a request route matches one
 *   of these, it passes through the authentication stack instantly.
 * @param {String} [options.herokuAuthURL='https://id.heroku.com'] the
 *   authentication URL used
 * @param {Boolean} [options.herokaiOnly=false] whether or not to restrict this
 *   app to Herokai (users with @heroku.com email addresses)
 * @example
 * ```javascript
 * var bouncer = require('heroku-bouncer')({
 *   herokuBouncerSecret: process.env.HEROKU_BOUNCER_SECRET,
 *   herokuOAuthID      : process.env.HEROKU_OAUTH_ID,
 *   herokuOAuthSecret  : process.env.HEROKU_OAUTH_SECRET
 * });
 *
 * app.use(bouncer.middleware);
 * app.use(bouncer.router);
 * ```
 */
module.exports = function(options) {
  var router = new express.Router();

  options = options || {};
  enforceOptions(options);

  router.middleware = middleware(options);
  router.router     = routes(options);
  router.use(router.middleware);
  router.use(router.router);

  return router;
};

function enforceOptions(options) {
  if (!options.herokuBouncerSecret) {
    throw new Error('No `herokuBouncerSecret` provided to heroku-bouncer');
  }

  if (!options.herokuOAuthID) {
    throw new Error('No `herokuOAuthID` provided to heroku-bouncer');
  }

  if (!options.herokuOAuthSecret) {
    throw new Error('No `herokuOAuthSecret` provided to heroku-bouncer');
  }

  if (!options.hasOwnProperty('ignoreRoutes')) {
    options.ignoreRoutes = [];
  }

  options.herokuAuthURL = options.herokuAuthURL || 'https://id.heroku.com';
  options.herokaiOnlyRedirect = options.herokaiOnlyRedirect || 'https://www.heroku.com';
  options.herokaiOnly   = options.herokaiOnly || false;
}
