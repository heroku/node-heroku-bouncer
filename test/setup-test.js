'use strict';

describe('setup', function() {
  it('throws an error when not given a `herokuBouncerSecret`', function() {
    function requireIndex() {
      require('../index')();
    }

    requireIndex.should.throw('No `herokuBouncerSecret` provided to heroku-bouncer');
  });

  it('throws an error when not given a `herokuOAuthID`', function() {
    function requireIndex() {
      require('../index')({ herokuBouncerSecret: 'foo' });
    }

    requireIndex.should.throw('No `herokuOAuthID` provided to heroku-bouncer');
  });

  it('throws an error when not given a `herokuOAuthSecret`', function() {
    function requireIndex() {
      require('../index')({
        herokuBouncerSecret: 'foo',
        herokuOAuthID: '123'
      });
    }

    requireIndex.should.throw('No `herokuOAuthSecret` provided to heroku-bouncer');
  });
});
