# node-heroku-bouncer

node-heroku-bouncer is an easy-to-use module for adding Heroku OAuth
authentication to express apps.

## Install

```sh
$ npm install heroku-bouncer --save
```

## Use

node-heroku-bouncer assumes you've already added the express
[cookieParser][cookieParser] and [cookieSession][cookieSession] middlewares to
your app. To set it up, pass it your OAuth client ID and secret and another
secret used to encrypt your user's OAuth session data.

Use the `bouncer.middleware` object to set up middleware that will ensure that
your users are logged in (and redirect otherwise), and the `bouncer.routes`
object to add the OAuth-specific routes to your app:

```javascript
var express = require('express');
var app     = express();

app.use(express.cookieParser('your cookie secret'));
app.use(express.cookieSession({
  secret: 'your session secret',
  cookie: {
    path    : '/',
    signed  : true,
    httpOnly: true,
    maxAge  : null
  }
}));

var bouncer = require('heroku-bouncer')({
  herokuOAuthID      : 'client-id',
  herokuOAuthSecret  : 'client-secret',
  herokuBouncerSecret: 'bouncer-secret'
});

app.use(bouncer.middleware);
app.use(bouncer.router);

app.get('/', function(req, res) {
  res.end('you must be logged in!');
});
```

To log a user out, send them to `/auth/heroku/logout`.

## Test

```sh
$ npm test
```

[cookieParser]:  http://expressjs.com/3x/api.html#cookieParser
[cookieSession]: http://expressjs.com/3x/api.html#cookieSession
