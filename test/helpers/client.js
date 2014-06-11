'use strict';

var server       = require('../fixtures/server');
var createClient = require('../fixtures/client');

server.listen();

exports.createClient = function(options, cb) {
  var defaultOptions = {
    herokuOAuthID      : 'client-id',
    herokuOAuthSecret  : 'client-secret',
    herokuBouncerSecret: 'bouncer-secret',
    herokuAuthURL      : 'http://localhost:' + server.address().port,
    ignoreRoutes       : [/^\/ignore/],
    herokaiOnly        : false
  };

  options = options || {};

  for (var key in defaultOptions) {
    if (!options.hasOwnProperty(key)) {
      options[key] = defaultOptions[key];
    }
  }

  var client = createClient(options);
  client.serverPort = server.address().port;
  client.listen(function() {
    server.clientPort = client.address().port;
    cb(null, client);
  });
};
