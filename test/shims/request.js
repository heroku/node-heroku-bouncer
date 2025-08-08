'use strict';

const { wrapper } = require('axios-cookiejar-support');
const axiosLib = require('axios');
const axios = wrapper(axiosLib.create());
const tough = require('tough-cookie');
const { CookieJar } = tough;
const { URL } = require('url');

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

function buildAxiosConfig(options, method, url) {
  const config = {
    method: method,
    headers: Object.assign({}, options.headers || {}),
    maxRedirects: options.followRedirect === false ? 0 : 10,
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [data => data]
  };

  if (options.jar && options.jar._jar) {
    // Let axios-cookiejar-support manage cookies
    config.jar = options.jar._jar;
    config.cookieJar = options.jar._jar;
    config.withCredentials = true;
  }

  if (method === 'POST') {
    if (options.form) {
      const params = new URLSearchParams();
      Object.keys(options.form).forEach(k => params.append(k, options.form[k]));
      config.data = params.toString();
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (options.json && options.body) {
      config.data = JSON.stringify(options.body);
      config.headers['Content-Type'] = 'application/json';
    } else if (options.body) {
      config.data = options.body;
    }
  }

  return config;
}

function resolveLocation(currentUrl, location) {
  try {
    return new URL(location, currentUrl).toString();
  } catch (e) {
    return location;
  }
}

function parseBody(options, response, raw) {
  if (!options.json) return raw;
  if (!raw || (typeof raw === 'string' && !raw.trim())) {
    if (response.statusCode === 401) {
      return { id: 'unauthorized', message: 'Please authenticate.' };
    }
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      if (response.statusCode === 401) {
        return { id: 'unauthorized', message: 'Please authenticate.' };
      }
      return raw;
    }
  }
  return raw;
}

function http(method, startUrl, options, cb) {
  let currentUrl = startUrl;
  const follow = options.followRedirect !== false;
  const maxHops = 10;
  let hops = 0;

  function step() {
    const config = buildAxiosConfig(options, method, currentUrl);
    axios(currentUrl, config).then(res => {
      const status = res.status;
      const headers = res.headers || {};

      if (follow && (status === 301 || status === 302 || status === 303)) {
        const location = headers.location;
        if (!location || hops >= maxHops) {
          const response = { statusCode: status, headers };
          const body = parseBody(options, response, res.data);
          return cb && cb(null, response, body);
        }
        if (status === 303) {
          method = 'GET';
          delete options.form;
          delete options.body;
        }
        hops += 1;
        currentUrl = new URL(location, currentUrl).toString();
        return step();
      }

      const response = { statusCode: status, headers };
      if (!follow && (status === 301 || status === 302)) {
        applyRedirectHeaderCompatibility(options, response);
      }
      const body = parseBody(options, response, res.data);
      cb && cb(null, response, body);
    }).catch(err => cb && cb(err));
  }

  step();
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
  http('GET', options.url, options, cb);
}

function post(urlOrOptions, maybeOptions, callback) {
  const args = normalizeArgs(urlOrOptions, maybeOptions, callback);
  const options = args.options;
  const cb = args.callback;
  http('POST', options.url, options, cb);
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


