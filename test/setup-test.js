// jshint -W068

'use strict';

describe('setup', function() {
  it('throws an error when not given a `sessionSecret`', function() {
    (function() {
      require('../index')();
    }).should.throw('No `sessionSecret` provided to heroku-bouncer');
  });

  it('throws an error when not given a `oAuthClientID`', function() {
    (function() {
      require('../index')({ sessionSecret: 'foo' });
    }).should.throw('No `oAuthClientID` provided to heroku-bouncer');
  });

  it('throws an error when not given a `oAuthClientSecret`', function() {
    (function() {
      require('../index')({
        sessionSecret: 'foo',
        oAuthClientID: '123'
      });
    }).should.throw('No `oAuthClientSecret` provided to heroku-bouncer');
  });
});
