# node-heroku-bouncer [![Build Status](https://travis-ci.org/heroku/node-heroku-bouncer.svg?branch=master)](https://travis-ci.org/heroku/node-heroku-bouncer)

node-heroku-bouncer is an easy-to-use module for adding Heroku OAuth
authentication to Express 4 apps.

## Install

```sh
$ npm install heroku-bouncer --save
```

## Requirements

- Node 0.10.x
- Express 4.x

## Use

Ensure your app is using the [cookie-parser][cookieParser] and
[client-sessions][clientSessions] middlewares. This module is not guaranteed to
work with any other session middleware.

```javascript
var express      = require('express');
var cookieParser = require('cookie-parser');
var sessions     = require('client-sessions');
var bouncer      = require('heroku-bouncer');
var app          = express();

app.use(cookieParser('your cookie secret'));

// NOTE: These options are good general options for use in a Heroku app, but
// carefully review your own environment's needs before just copying these.
app.use(sessions({
  cookieName    : 'session',
  secret        : 'your session secret',
  duration      : 24 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5,
  cookie        : {
    path     : '/',
    ephemeral: false,
    httpOnly : true,
    secure   : false
  }
}));

app.use(bouncer({
  oAuthClientID      : 'client-id',
  oAuthClientSecret  : 'client-secret',
  encryptionSecret   : 'abcd1234abcd1234'
}));

app.get('/', function(req, res) {
  res.end('You must be logged in.');
});
```

After requests pass through the bouncer middleware, they'll have the
`heroku-bouncer` property on them:

```javascript
{
  token: 'user-api-token',
  id   : 'user-id',
  name : 'user-name',
  email: 'user-email'
}
```

To log a user out, send them to `/auth/heroku/logout`.

### Options

| Options | Required? | Default | Description |
|---------|-----------|---------|-------------|
| `encryptionSecret` | Yes | n/a | A random string used to encrypt your user session data |
| `oAuthClientID` | Yes | n/a | The ID of your Heroku OAuth client |
| `oAuthClientSecret` | Yes | n/a | The secret of your Heroku OAuth client |
| `oAuthScope` | No | `"identity"` | The requested [scope][scope] for the authorization |
| `herokuAPIHost` | No | n/a | An optional override host to send Heroku API requests to |
| `sessionSyncNonce` | No | `null` | The name of a nonce cookie to validate sessions against |
| `ignoredRoutes` | No | `[]` | An array of regular expressions to match routes to be ignored when there is no session active |
| `oAuthServerURL` | No | `"https://id.heroku.com"` | The location of the Heroku OAuth server |
| `herokaiOnlyHandler` | No | `null` | A route handler that will be called on requests by non-Herokai |

## Test

```sh
$ npm test
```

[cookieParser]:   https://github.com/expressjs/cookie-parser
[clientSessions]: https://github.com/mozilla/node-client-sessions
[scope]:          https://devcenter.heroku.com/articles/oauth#scopes
