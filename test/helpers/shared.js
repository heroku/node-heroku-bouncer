var request = require('request');

exports.shouldNotRedirect = function(client, done) {
  var jar = request.jar();

  request({
    jar: jar,
    url: 'http://localhost:' + client.address().port
  }, function(err, res) {
    if (err) throw err;

    request({
      jar: jar,
      url: 'http://localhost:' + client.address().port + '/hello',
      followRedirect: false
    }, function(err, res) {
      if (err) throw err;

      res.body.should.eql('hello world');
      done();
    });
  });
};

exports.shouldRedirect = function(client, done) {
  var jar = request.jar();

  request({
    jar: jar,
    url: 'http://localhost:' + client.address().port
  }, function(err, res) {
    if (err) throw err;

    request({
      jar: jar,
      url: 'http://localhost:' + client.address().port + '/helloo',
      followRedirect: false
    }, function(err, res) {
      if (err) throw err;

      res.headers['location'].should.eql('https://www.heroku.com')
      done();
    });
  });
};
