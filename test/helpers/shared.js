'use strict';

var Promise = require('bluebird');
var request = require('request');
var get     = Promise.promisify(request.get, {multiArgs: true});

exports.shouldNotRedirect = function() {
  var jar = request.jar();

  return get({
    jar: jar,
    url: this.url
  }).then(function() {
    return get({
      jar           : jar,
      url           : this.url + '/hello',
      followRedirect: false
    });
  }.bind(this)).spread(function(res, body) {
    body.should.eql('hello world');
  });
};

exports.shouldRedirect = function() {
  var jar = request.jar();

  return get({
    jar: jar,
    url: this.url
  }).then(function() {
    return get({
      jar           : jar,
      url           : this.url + '/hello',
      followRedirect: false
    });
  }.bind(this)).spread(function(res) {
    res.headers.location.should.eql('https://www.heroku.com');
  });
};
