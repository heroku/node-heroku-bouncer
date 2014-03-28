'use strict';

var middleware    = require('./lib/middleware');
var router        = require('./lib/router');

module.exports = function(options) {
  options || (options = {});
  enforceOptions(options);

  return {
    middleware: middleware(options),
    router    : router(options)
  };
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

  options.herokuAuthURL || (options.herokuAuthURL = 'https://id.heroku.com');
}
