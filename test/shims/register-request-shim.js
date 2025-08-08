'use strict';

// Replace imports of 'request' with our got-backed compatibility shim at test time
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request === 'request') {
    return require('./request');
  }
  return originalLoad.apply(this, arguments);
};


