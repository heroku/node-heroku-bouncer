var should = require('should');

describe('setup', function() {
  it('throws an error when not given a `herokuBouncerSecret`', function() {
    (function() {
      require('../index')();
    }).should.throw('No `herokuBouncerSecret` provided to heroku-bouncer');
  });

  it('throws an error when not given a `herokuOAuthID`', function() {
    (function() {
      require('../index')({ herokuBouncerSecret: 'foo' });
    }).should.throw('No `herokuOAuthID` provided to heroku-bouncer');
  });

  it('throws an error when not given a `herokuOAuthSecret`', function() {
    (function() {
      require('../index')({
        herokuBouncerSecret: 'foo',
        herokuOAuthID: '123'
      });
    }).should.throw('No `herokuOAuthSecret` provided to heroku-bouncer');
  });
});
