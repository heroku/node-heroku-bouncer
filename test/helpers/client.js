var server          = require('../fixtures/server');
var objectMerge     = require('object-merge');

server.listen(0);

var serverPort      = server.address().port;

var defaultOptions  = {
      herokuOAuthID      : 'client-id',
      herokuOAuthSecret  : 'client-secret',
      herokuBouncerSecret: 'bouncer-secret',
      herokuAuthURL      : 'http://localhost:' + serverPort,
      ignoreRoutes       : [/^\/ignore/]
    }

var clientPort;
var client;

exports.boot = function(options) {
  var options = objectMerge(options, defaultOptions);

  client = require('../fixtures/client')(server.address().port, options);
  client.listen(0);
  clientPort = client.address().port;
  return server.clientPort = clientPort;
};

exports.kill = function() {
  client.close();
}

exports.port = function() {
  return clientPort;
}

exports.serverPort = function() {
  return serverPort;
}