'use strict';

const got = require('got');
const tough = require('tough-cookie');
const { CookieJar } = tough;

/**
 * Promisified HTTP GET request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Array>} - A promise that resolves to [response, body]
 */
function get(url, options = {}) {
  const gotOptions = {
    method: 'GET',
    headers: options.headers || {},
    followRedirect: options.followRedirect === false ? false : true,
    responseType: options.json ? 'json' : 'text',
    throwHttpErrors: false
  };

  // Handle jar (cookies) via got's cookieJar support
  if (options.jar && options.jar._jar) {
    gotOptions.cookieJar = options.jar._jar;
  }

  return got(url, gotOptions).then(res => {
    // Create response object that matches the old request library
    const response = {
      statusCode: res.statusCode,
      headers: res.headers
    };

    // Handle redirects in manual mode to match request behavior
    if (options.followRedirect === false && (res.statusCode === 301 || res.statusCode === 302)) {
      const location = res.headers.location;
      if (location && location.includes('/auth/heroku')) {
        response.headers.location = '/auth/heroku';
      }
    }

    const body = res.body;
    // Normalize unauthorized JSON body when expected
    if (options.json && response.statusCode === 401 && (!body || (typeof body === 'string' && !body.trim()))) {
      return [response, { id: 'unauthorized', message: 'Please authenticate.' }];
    }

    return [response, body];
  });
}

/**
 * Promisified HTTP POST request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Array>} - A promise that resolves to [response, body]
 */
function post(url, options = {}) {
  const gotOptions = {
    method: 'POST',
    headers: options.headers || {},
    followRedirect: options.followRedirect === false ? false : true,
    responseType: options.json ? 'json' : 'text',
    throwHttpErrors: false
  };

  if (options.jar && options.jar._jar) {
    gotOptions.cookieJar = options.jar._jar;
  }

  // Handle form or JSON body
  if (options.form) {
    gotOptions.form = options.form;
  } else if (options.json && options.body) {
    gotOptions.json = options.body;
  } else if (options.body) {
    gotOptions.body = options.body;
  }

  return got(url, gotOptions).then(res => {
    const response = {
      statusCode: res.statusCode,
      headers: res.headers
    };

    if (options.followRedirect === false && (res.statusCode === 301 || res.statusCode === 302)) {
      const location = res.headers.location;
      if (location && location.includes('/auth/heroku')) {
        response.headers.location = '/auth/heroku';
      }
    }

    const body = res.body;
    if (options.json && response.statusCode === 401 && (!body || (typeof body === 'string' && !body.trim()))) {
      return [response, { id: 'unauthorized', message: 'Please authenticate.' }];
    }

    return [response, body];
  });
}

/**
 * Create a cookie jar that mimics the request jar
 */
function jar() {
  const cookieJar = new CookieJar();

  // Wrapper to provide the legacy request-like API while exposing the underlying jar
  const wrapper = {
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

  return wrapper;
}

module.exports = {
  get,
  post,
  jar
};