'use strict';

var herokuStub = require('./helpers/heroku');

afterEach(function() {
  herokuStub.reset();
});
