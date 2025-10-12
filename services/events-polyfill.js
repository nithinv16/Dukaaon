/**
 * Simple EventEmitter polyfill for React Native
 */
class EventEmitter {
  constructor() {
    this._events = {};
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(listener);
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.removeListener(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  off(event, listener) {
    return this.removeListener(event, listener);
  }

  removeListener(event, listener) {
    if (!this._events[event]) return this;
    const idx = this._events[event].indexOf(listener);
    if (idx !== -1) this._events[event].splice(idx, 1);
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
    }
    return this;
  }

  emit(event, ...args) {
    if (!this._events[event]) return false;
    this._events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error(e);
      }
    });
    return true;
  }

  listenerCount(event) {
    return this._events[event] ? this._events[event].length : 0;
  }

  listeners(event) {
    return this._events[event] ? [...this._events[event]] : [];
  }
}

module.exports = {
  EventEmitter
};

// Polyfill for Node.js events module in React Native
// This file is referenced in metro.config.js

module.exports = require('events'); 