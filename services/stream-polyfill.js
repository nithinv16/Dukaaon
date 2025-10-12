/**
 * Minimal stream polyfill for React Native
 */
import { EventEmitter } from './events-polyfill';

class Duplex extends EventEmitter {
  constructor(options = {}) {
    super();
    this.readable = true;
    this.writable = true;
    this._readableState = { objectMode: options.objectMode || false };
    this._writableState = { objectMode: options.objectMode || false };
  }

  write(chunk, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = 'utf8';
    }
    
    this.emit('data', chunk);
    
    if (callback) {
      process.nextTick(callback);
    }
    
    return true;
  }

  end(chunk, encoding, callback) {
    if (chunk) {
      this.write(chunk, encoding);
    }
    
    this.emit('end');
    this.emit('close');
    
    if (callback) {
      process.nextTick(callback);
    }
    
    return this;
  }

  pipe(destination) {
    this.on('data', (chunk) => {
      destination.write(chunk);
    });
    
    this.on('end', () => {
      destination.end();
    });
    
    return destination;
  }

  read() {
    return null;
  }

  push(chunk) {
    if (chunk === null) {
      this.emit('end');
      return false;
    }
    
    this.emit('data', chunk);
    return true;
  }

  destroy(err) {
    if (err) {
      this.emit('error', err);
    }
    this.emit('close');
    return this;
  }
}

class Writable extends EventEmitter {
  constructor(options = {}) {
    super();
    this.writable = true;
    this._writableState = { objectMode: options.objectMode || false };
  }

  write(chunk, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = 'utf8';
    }
    
    if (callback) {
      process.nextTick(callback);
    }
    
    return true;
  }

  end(chunk, encoding, callback) {
    if (chunk) {
      this.write(chunk, encoding);
    }
    
    this.emit('finish');
    this.emit('close');
    
    if (callback) {
      process.nextTick(callback);
    }
    
    return this;
  }

  destroy(err) {
    if (err) {
      this.emit('error', err);
    }
    this.emit('close');
    return this;
  }
}

class Readable extends EventEmitter {
  constructor(options = {}) {
    super();
    this.readable = true;
    this._readableState = { objectMode: options.objectMode || false };
  }

  read() {
    return null;
  }

  push(chunk) {
    if (chunk === null) {
      this.emit('end');
      return false;
    }
    
    this.emit('data', chunk);
    return true;
  }

  pipe(destination) {
    this.on('data', (chunk) => {
      destination.write(chunk);
    });
    
    this.on('end', () => {
      destination.end();
    });
    
    return destination;
  }

  destroy(err) {
    if (err) {
      this.emit('error', err);
    }
    this.emit('close');
    return this;
  }
}

module.exports = require('stream-browserify'); 