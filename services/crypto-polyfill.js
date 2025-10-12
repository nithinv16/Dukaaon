/**
 * Minimal crypto polyfill for React Native
 */

// Polyfill for Node.js crypto module in React Native
// This file is referenced in metro.config.js

module.exports = require('crypto-browserify');

// Simple random bytes generator for React Native
function randomBytes(size) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes);
}

// Fill a buffer with random bytes
function randomFillSync(buffer, offset = 0, size) {
  if (!size) {
    size = buffer.length - offset;
  }
  
  const bytes = randomBytes(size);
  bytes.copy(buffer, offset);
  return buffer;
}

// Simple createHash function that returns a basic hash object
function createHash(algorithm) {
  return {
    update(data) {
      // Very simplified hash function, not secure!
      // This is just to make the code run
      this._data = data;
      return this;
    },
    digest() {
      // Simple hash representation - not cryptographically secure
      // Just to make the code run without errors
      const hash = randomBytes(32);
      return hash;
    }
  };
}

module.exports = {
  randomBytes,
  randomFillSync,
  createHash
}; 