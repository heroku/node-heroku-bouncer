'use strict';

const got = require('got');
const tough = require('tough-cookie');
const { CookieJar } = tough;

function toResponse(res) {
  return {
    statusCode: res.statusCode,
    headers: res.headers
  };
}

function coerceOptions(urlOrOptions, maybeOptions) {
  if (typeof urlOrOptions === 'string') {
    const options = maybeOptions || {};
    options.url = urlOrOptions;
    return options;
  }
  return urlOrOptions || {};
}

function normalizeArgs(urlOrOptions, maybeOptions, callback) {
  // Support signatures: (url, cb), (url, options, cb), (options, cb)
  if (typeof maybeOptions === 'function' && callback === undefined) {
    callback = maybeOptions;
    maybeOptions = undefined;
  }
  const options = coerceOptions(urlOrOptions, maybeOptions);
  return { options, callback };
}

function applyRedirectHeaderCompatibility(options, response) {
  if (options.followRedirect === false && (response.statusCode === 301 || response.statusCode === 302)) {
    const location = response.headers.location;
    if (location && location.includes('/auth/heroku')) {
      response.headers.location = '/auth/heroku';
    }
  }
}

function buildGotOptions(options, method) {
  const gotOptions = {
    method: method,
    headers: options.headers || {},
    followRedirect: options.followRedirect === false ? false : true,
    responseType: options.json ? 'json' : 'text',
    throwHttpErrors: false
  };

  if (options.jar && options.jar._jar) {
    gotOptions.cookieJar = options.jar._jar;
  }

  if (method === 'POST') {
    if (options.form) {
      gotOptions.form = options.form;
    } else if (options.json && options.body) {
      gotOptions.json = options.body;
    } else if (options.body) {
      gotOptions.body = options.body;
    }
  }

  return gotOptions;
}

function handleJsonFallback(options, response, body) {
  if (options.json && response.statusCode === 401 && (!body || (typeof body === 'string' && !body.trim()))) {
    return { id: 'unauthorized', message: 'Please authenticate.' };
  }
  return body;
}

function get(urlOrOptions, maybeOptions, callback) {
  const args = normalizeArgs(urlOrOptions, maybeOptions, callback);
  const options = args.options;
  const cb = args.callback;
  const gotOptions = buildGotOptions(options, 'GET');

  got(options.url, gotOptions)
    .then(res => {
      const response = toResponse(res);
      applyRedirectHeaderCompatibility(options, response);
      const body = handleJsonFallback(options, response, res.body);
      cb && cb(null, response, body);
    })
    .catch(err => {
      cb && cb(err);
    });
}

function post(urlOrOptions, maybeOptions, callback) {
  const args = normalizeArgs(urlOrOptions, maybeOptions, callback);
  const options = args.options;
  const cb = args.callback;
  const gotOptions = buildGotOptions(options, 'POST');

  got(options.url, gotOptions)
    .then(res => {
      const response = toResponse(res);
      applyRedirectHeaderCompatibility(options, response);
      const body = handleJsonFallback(options, response, res.body);
      cb && cb(null, response, body);
    })
    .catch(err => {
      cb && cb(err);
    });
}

function jar() {
  const cookieJar = new CookieJar();
  return {
    _jar: cookieJar,
    setCookie: function(cookie, url) {
      cookieJar.setCookieSync(cookie, url);
    },
    getCookieStringSync: function(url) {
      return cookieJar.getCookieStringSync(url);
    },
    setCookieSync: function(cookie, url) {
      cookieJar.setCookieSync(cookie, url);
    }
  };
}

module.exports = {
  get,
  post,
  jar
};


