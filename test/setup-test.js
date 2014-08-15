// jshint -W068

'use strict';

describe('setup', function() {
  it('throws an error when not given a `encryptionSecret`', function() {
    (function() {
      require('../index')();
    }).should.throw('No `encryptionSecret` provided to heroku-bouncer');
  });

  it('throws an error when not given a `oAuthClientID`', function() {
    (function() {
      require('../index')({ encryptionSecret: 'foo' });
    }).should.throw('No `oAuthClientID` provided to heroku-bouncer');
  });

  it('throws an error when not given a `oAuthClientSecret`', function() {
    (function() {
      require('../index')({
        encryptionSecret: 'foo',
        oAuthClientID   : '123'
      });
    }).should.throw('No `oAuthClientSecret` provided to heroku-bouncer');
  });

  it('throws an error if `herokaiOnlyHandler` is not a function', function() {
    (function() {
      require('../index')({
        encryptionSecret  : 'foo',
        oAuthClientID     : '123',
        oAuthClientSecret : '123',
        herokaiOnlyHandler: true
      });
    }).should.throw('`herokaiOnlyHandler` must be a handler function');
  });
});
