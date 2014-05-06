var Heroku = require('heroku-client');

Heroku.prototype.account = function() {
  return {
    info: function(cb) {
      process.nextTick(function() {
        cb(null, { email: 'user@example.com', name: 'Jane Smith' });
      });
    }
  };
};

module.exports = Heroku;
