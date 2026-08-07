# Polyfills

This directory contains polyfills for Node.js modules that are not available in React Native environments.

## Files

### crypto-polyfill.js
Provides crypto functionality for React Native:
- `randomBytes(size)` - Generate random bytes
- `randomFillSync(buffer, offset, size)` - Fill buffer with random bytes
- `createHash(algorithm)` - Create a hash object (simplified, not cryptographically secure)

Delegates to `crypto-browserify` for full compatibility.

### events-polyfill.js
Provides EventEmitter class for React Native:
- `on(event, listener)` - Add event listener
- `once(event, listener)` - Add one-time event listener
- `off(event, listener)` - Remove event listener
- `emit(event, ...args)` - Emit event
- `removeAllListeners(event)` - Remove all listeners

Delegates to `events` npm package for full compatibility.

### stream-polyfill.js
Provides stream classes for React Native:
- `Readable` - Readable stream class
- `Writable` - Writable stream class
- `Duplex` - Duplex stream class

Delegates to `stream-browserify` for full compatibility.

## Usage

These polyfills are configured in `metro.config.js` for automatic resolution when Node.js modules are imported.

For direct usage:
```javascript
const { crypto, events, stream } = require('./polyfills');
```

## Note

The custom implementations in these files serve as fallbacks. For production use, the npm packages (`crypto-browserify`, `events`, `stream-browserify`) provide more complete and tested implementations.
