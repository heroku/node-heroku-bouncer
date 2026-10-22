// jshint esversion: 8, -W030
/* globals __dirname, setTimeout */

'use strict';

// Failures while completing the OAuth callback must reach Express as an error
// response instead of an exception thrown from an async callback, which would
// kill the host app's whole process (neither hc-support nor hc-dashboard
// installs an uncaughtException handler).
//
// The bouncer runs in a child process (test/fixtures/crash-app.js) so that a
// crash is observable as a real process exit. The identity server and the
// Heroku API are stubs listening on 127.0.0.1. heroku-client only speaks HTTPS
// to its host on port 443, so the API stub is reached through its
// HEROKU_HTTP_PROXY_HOST/PORT support, which makes it send plain HTTP to
// 127.0.0.1 with `herokuAPIHost` (an unresolvable `.invalid` name) only in the
// request path. The child also preloads helpers/block-external-network.js,
// which refuses any non-loopback connection and reports it on stderr.

require('should');

var axios        = require('axios');
var childProcess = require('child_process');
var http         = require('http');
var path         = require('path');

var APP     = path.join(__dirname, 'fixtures', 'crash-app.js');
var GUARD   = path.join(__dirname, 'helpers', 'block-external-network.js');
var SECRET  = 'LEAK-ME-token-and-body';
var API_HOST = 'api.invalid';

describe('OAuth callback failures', function() {
  this.timeout(15000);

  var stub, app;

  beforeEach(async function() {
    stub = await startStub();
    app  = await startApp(stub);
  });

  afterEach(async function() {
    await app.stop();
    await stub.stop();
  });

  describe('when the identity server rejects the code', function() {
    // GET /auth/heroku/callback?code=bogus is reachable without logging in.
    it('responds 401 and keeps the process alive', async function() {
      stub.exchange = 'error400';
      var res = await app.callback('bogus');

      res.status.should.eql(401);
      await assertSurvivedWithoutSession(res);
    });
  });

  [
    ['the identity server fails',                   { exchange: 'error500' }],
    ['the identity connection is dropped',          { exchange: 'drop' }],
    ['the identity server returns no access token', { exchange: 'noToken' }],
    ['the account lookup fails',                    { api: 'error500' }],
    ['the account lookup is rejected',              { api: 'error401' }],
    ['the account lookup connection is dropped',    { api: 'drop' }],
    ['the account lookup returns an empty account', { api: 'null' }]
  ].forEach(function(scenario) {
    describe('when ' + scenario[0], function() {
      it('responds 502 and keeps the process alive', async function() {
        Object.assign(stub, scenario[1]);
        var res = await app.callback('bogus');

        res.status.should.eql(502);
        if (scenario[1].api) {
          // The failure really came from the (stubbed) API, over the proxy path.
          stub.requests.should.containEql('GET https://' + API_HOST + '/account');
        }
        await assertSurvivedWithoutSession(res);
      });
    });
  });

  describe('when everything succeeds', function() {
    it('still logs the user in and redirects to the requested path', async function() {
      var start = await app.get('/auth/heroku?redirectPath=/hello-world');
      start.status.should.eql(302);
      start.headers.location.should.startWith(stub.url + '/oauth/authorize');

      var res = await app.callback('good-code');
      res.status.should.eql(302);
      res.headers.location.should.eql('/hello-world');

      var page = await app.get('/hello-world');
      page.status.should.eql(200);
      page.data.should.eql('hello world');

      stub.requests.should.containEql('GET https://' + API_HOST + '/account');
      app.assertAlive();
    });

    it('redirects to / when no path was requested', async function() {
      var res = await app.callback('good-code');
      res.status.should.eql(302);
      res.headers.location.should.eql('/');
    });
  });

  // Not part of the uncaught-throw class, but the same process-survival
  // question applies to the token refresh in lib/middleware.js.
  describe('when refreshing an expired token', function() {
    [
      ['the identity server fails',       'error500'],
      ['the identity connection drops',   'drop'],
      ['the identity server sends null',  'null']
    ].forEach(function(scenario) {
      it('reauthenticates and keeps the process alive when ' + scenario[0], async function() {
        stub.expiresIn = 0;
        (await app.callback('good-code')).status.should.eql(302);

        stub.refresh = scenario[1];
        var res = await app.get('/hello-world');

        res.status.should.eql(302);
        res.headers.location.should.eql('/auth/heroku');
        await app.assertHealthy();
      });
    });
  });

  describe('the network guard', function() {
    it('blocks connections to real hosts and allows loopback', async function() {
      var script = [
        'var net = require("net");',
        'var s = net.createServer(function(c) { c.end(); }).listen(0, "127.0.0.1", function() {',
        '  net.connect(s.address().port, "127.0.0.1").on("connect", function() {',
        '    console.log("LOOPBACK_OK");',
        '    net.connect(443, "api.heroku.com").on("error", function(e) {',
        '      require("https").get("https://id.heroku.com").on("error", function(e2) {',
        '        console.log(e.message + " | " + e2.message);',
        '        process.exit(0);',
        '      });',
        '    });',
        '  });',
        '});'
      ].join('\n');

      var out = await run(['-r', GUARD, '-e', script]);

      out.stdout.should.containEql('LOOPBACK_OK');
      out.stdout.should.containEql('Blocked connection to non-loopback host api.heroku.com');
      out.stdout.should.containEql('Blocked connection to non-loopback host id.heroku.com');
      out.stderr.should.containEql('BLOCKED_EXTERNAL_CONNECT api.heroku.com');
      out.stderr.should.containEql('BLOCKED_EXTERNAL_CONNECT id.heroku.com');
    });
  });

  async function assertSurvivedWithoutSession(res) {
    // A controlled error: a plain status page, none of the upstream detail.
    var body = String(res.data);
    body.should.not.containEql(SECRET);
    body.should.not.containEql('stub-access-token');
    body.should.not.containEql('Error:'); // no stack trace

    // No session was created by the failed attempt.
    var next = await app.get('/hello-world');
    next.status.should.eql(302);
    next.headers.location.should.eql('/auth/heroku');

    await app.assertHealthy();
  }
});

// A stub of the Heroku identity server (/oauth/token) and the Heroku API
// (/account, received as a proxied absolute-URL request).
function startStub() {
  var stub = {
    exchange: 'ok',
    refresh : 'ok',
    api     : 'ok',
    expiresIn: 28800,
    requests: []
  };

  var server = http.createServer(function(req, res) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      stub.requests.push(req.method + ' ' + req.url);

      if (req.url === '/oauth/token') {
        var refreshing = /grant_type=refresh_token/.test(body);
        return respondToken(res, refreshing ? stub.refresh : stub.exchange);
      }

      if (req.url === 'https://' + API_HOST + '/account') {
        return respondAccount(res, stub.api);
      }

      res.statusCode = 404;
      res.end('unexpected request to stub: ' + req.url);
    });
  });

  function respondToken(res, mode) {
    switch (mode) {
    case 'ok':
      return json(res, 200, {
        access_token : 'stub-access-token',
        refresh_token: 'stub-refresh-token',
        expires_in   : stub.expiresIn
      });
    case 'error400':
      return json(res, 400, { error: 'invalid_grant', detail: SECRET });
    case 'error500':
      return json(res, 500, { error: 'server_error', detail: SECRET });
    case 'noToken':
      return json(res, 200, { token_type: 'bearer' });
    case 'null':
      return json(res, 200, null);
    case 'drop':
      return res.socket.destroy();
    }
  }

  function respondAccount(res, mode) {
    switch (mode) {
    case 'ok':
      return json(res, 200, { id: 'abc', name: 'Jane Smith', email: 'user@example.com' });
    case 'error500':
      return json(res, 500, { id: 'internal', message: SECRET });
    case 'error401':
      return json(res, 401, { id: 'unauthorized', message: SECRET });
    case 'null':
      return json(res, 200, null);
    case 'drop':
      return res.socket.destroy();
    }
  }

  function json(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }

  return new Promise(function(resolve) {
    server.listen(0, '127.0.0.1', function() {
      stub.port = server.address().port;
      stub.url  = 'http://127.0.0.1:' + stub.port;
      stub.stop = function() {
        return new Promise(function(done) {
          server.close(done);
          if (server.closeAllConnections) { server.closeAllConnections(); }
        });
      };
      resolve(stub);
    });
  });
}

// Starts the host app as a child process and returns a small client for it.
function startApp(stub) {
  var options = {
    encryptionSecret : 'abcd1234abcd1234',
    oAuthClientID    : 'client-id',
    oAuthClientSecret: 'client-secret',
    oAuthServerURL   : stub.url,
    herokuAPIHost    : API_HOST
  };

  var child = childProcess.spawn(process.execPath, ['-r', GUARD, APP, JSON.stringify(options)], {
    // A minimal environment, so no proxy settings or credentials leak in.
    env: {
      PATH                  : process.env.PATH,
      NODE_ENV              : 'production',
      HEROKU_HTTP_PROXY_HOST: '127.0.0.1',
      HEROKU_HTTP_PROXY_PORT: String(stub.port)
    }
  });

  var stderr = '';
  var exited = null;
  var cookies = {};
  var exitPromise = new Promise(function(resolve) {
    child.on('exit', function(code, signal) {
      exited = { code: code, signal: signal };
      resolve();
    });
  });

  child.stderr.on('data', function(chunk) { stderr += chunk; });

  var app = {
    get: function(urlPath) {
      return axios.get(app.url + urlPath, {
        headers       : { Accept: 'text/html', Cookie: cookieHeader() },
        maxRedirects  : 0,
        validateStatus: function() { return true; }
      }).then(function(res) {
        [].concat(res.headers['set-cookie'] || []).forEach(function(setCookie) {
          var pair = setCookie.split(';')[0].split('=');
          cookies[pair[0]] = pair.slice(1).join('=');
        });
        return res;
      }, function(err) {
        // Most likely the process crashed mid-request: report why.
        return Promise.race([exitPromise, new Promise(function(resolve) { setTimeout(resolve, 500); })]).then(function() {
          err.message += exited ?
            ' (app process exited ' + JSON.stringify(exited) + '; stderr:\n' + stderr + ')' :
            ' (app process is still running)';
          throw err;
        });
      });
    },

    callback: function(code) {
      return app.get('/auth/heroku/callback?code=' + code);
    },

    assertAlive: function() {
      if (exited) {
        throw new Error('The app process exited (' + JSON.stringify(exited) + '). stderr:\n' + stderr);
      }
      stderr.should.not.containEql('BLOCKED_EXTERNAL_CONNECT');
    },

    assertHealthy: async function() {
      app.assertAlive();
      var res = await app.get('/healthz');
      res.status.should.eql(200);
      res.data.should.eql('ok');
      app.assertAlive();
    },

    stop: function() {
      if (!exited) { child.kill('SIGKILL'); }
      return exitPromise;
    }
  };

  function cookieHeader() {
    return Object.keys(cookies).map(function(name) {
      return name + '=' + cookies[name];
    }).join('; ');
  }

  return new Promise(function(resolve, reject) {
    child.stdout.on('data', function(chunk) {
      var match = /LISTENING (\d+)/.exec(String(chunk));
      if (match) {
        app.url = 'http://127.0.0.1:' + match[1];
        resolve(app);
      }
    });
    exitPromise.then(function() {
      reject(new Error('The app failed to start: ' + stderr));
    });
  });
}

function run(args) {
  return new Promise(function(resolve) {
    childProcess.execFile(process.execPath, args, { env: { PATH: process.env.PATH } }, function(err, stdout, stderr) {
      resolve({ stdout: stdout, stderr: stderr });
    });
  });
}
