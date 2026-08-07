/**
 * Polyfills Index
 * 
 * This directory contains polyfills for Node.js modules that are not
 * available in React Native environments. These polyfills provide
 * compatibility for libraries that depend on Node.js core modules.
 * 
 * Usage:
 * - crypto-polyfill.js: Provides crypto functionality (randomBytes, createHash)
 * - events-polyfill.js: Provides EventEmitter class
 * - stream-polyfill.js: Provides Readable, Writable, and Duplex stream classes
 * 
 * Note: Most polyfills delegate to npm packages (crypto-browserify, events, 
 * stream-browserify) for full compatibility. The custom implementations
 * serve as fallbacks or for specific use cases.
 */

const crypto = require('./crypto-polyfill');
const events = require('./events-polyfill');
const stream = require('./stream-polyfill');

module.exports = {
  crypto,
  events,
  stream,
};
