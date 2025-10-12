// Buffer polyfill with MAX_LENGTH constant
const { Buffer } = require('buffer/');

// Ensure Buffer is properly defined
if (typeof Buffer === 'undefined') {
  throw new Error('Buffer is not available');
}

// Add MAX_LENGTH constant if it doesn't exist
if (!Buffer.MAX_LENGTH) {
  Buffer.MAX_LENGTH = 0x3fffffff; // 1GB - 1 byte (Node.js default)
}

// Add other Buffer constants that might be missing
if (!Buffer.constants) {
  Buffer.constants = {
    MAX_LENGTH: Buffer.MAX_LENGTH,
    MAX_STRING_LENGTH: 0x3fffffff
  };
}

// Ensure Buffer.from is available
if (!Buffer.from) {
  Buffer.from = function(data, encoding) {
    return new Buffer(data, encoding);
  };
}

// Ensure Buffer.alloc is available
if (!Buffer.alloc) {
  Buffer.alloc = function(size, fill, encoding) {
    const buf = new Buffer(size);
    if (fill !== undefined) {
      buf.fill(fill, encoding);
    } else {
      buf.fill(0);
    }
    return buf;
  };
}

module.exports = { Buffer };
module.exports.Buffer = Buffer;