if (typeof __dirname === 'undefined') global.__dirname = '/'
if (typeof __filename === 'undefined') global.__filename = ''
if (typeof process === 'undefined') {
  global.process = require('process')
} else {
  const bProcess = require('process')
  for (var p in bProcess) {
    if (!(p in process)) {
      process[p] = bProcess[p]
    }
  }
}

process.browser = false
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer
  // Ensure MAX_LENGTH is available
  if (!global.Buffer.MAX_LENGTH) {
    global.Buffer.MAX_LENGTH = 0x3fffffff; // 1GB - 1 byte (Node.js default)
  }
}

// global.location = global.location || { port: 80 }
// Force production mode
global.__DEV__ = false;
process.env['NODE_ENV'] = 'production'
process.env['APP_ENV'] = 'production'
if (typeof localStorage !== 'undefined') {
  localStorage.debug = '' // Production mode - no debug
}

// If using the crypto shim, uncomment the following line to ensure
// crypto is loaded first, so it can populate global.crypto
// require('crypto')
