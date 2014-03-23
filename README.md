# node-heroku-bouncer

node-heroku-bouncer is an easy-to-use module for adding cookie-session-based
Heroku OAuth authentication to express apps.

## Install

```sh
$ npm install heroku-bouncer --save
$ echo SESSION_SECRET=$some_secret
$ echo COOKIE_SECRET=$another_secret
$ echo ENCRYPTION_SECRET=$final_secret
$ echo HEROKU_OAUTH_ID=$oauth_client_id
$ echo HEROKU_OAUTH_SECRET=$oauth_client_secret
$ echo HEROKU_AUTH_URL=https://id.heroku.com
```

## Use

node-heroku-bouncer adds the express `cookieParser` and `cookieSession`
middlewares to your app for you, and then adds the appropriate middleware
and OAuth routes.

```javascript
var app = require('express')();
require('heroku-bouncer')(app);

app.get('/', function(req, res) {
  // The user's token will be available:
  // `req['heroku-bouncer'].token;`

  res.end("I'm authenticated!")
});
```
