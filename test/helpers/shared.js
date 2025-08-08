'use strict';

var Promise = require('bluebird');
var httpUtils = require('./http-utils');
var get     = function(url, options) { return Promise.resolve(httpUtils.get(url, options)); };

exports.shouldNotRedirect = function() {
  var httpJar = httpUtils.jar();

  return get(this.url, { jar: httpJar }).then(function() {
    return get(this.url + '/hello', {
      jar           : httpJar,
      followRedirect: false
    });
  }.bind(this)).spread(function(res, body) {
    body.should.eql('hello world');
  });
};

exports.shouldRedirect = function() {
  var jar = httpUtils.jar();

  return get(this.url, { jar: jar }).then(function() {
    return get(this.url + '/hello', {
      jar           : jar,
      followRedirect: false
    });
  }.bind(this)).spread(function(res) {
    res.headers.location.should.eql('https://www.heroku.com');
  });
};
