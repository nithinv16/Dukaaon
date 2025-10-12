/**
 * Direct replacement for web-streams-polyfill/ponyfill
 * 
 * This file is used to resolve the web-streams-polyfill/ponyfill module
 * without directly requiring it, which causes resolution errors.
 */

// Import the base module
const WebStreamsPolyfill = require('web-streams-polyfill');

// Export everything for CommonJS
module.exports = {
  // Main classes
  ReadableStream: WebStreamsPolyfill.ReadableStream,
  WritableStream: WebStreamsPolyfill.WritableStream,
  TransformStream: WebStreamsPolyfill.TransformStream,
  
  // Additional classes
  ReadableStreamDefaultReader: WebStreamsPolyfill.ReadableStreamDefaultReader,
  ReadableStreamBYOBReader: WebStreamsPolyfill.ReadableStreamBYOBReader,
  ReadableStreamDefaultController: WebStreamsPolyfill.ReadableStreamDefaultController,
  WritableStreamDefaultWriter: WebStreamsPolyfill.WritableStreamDefaultWriter,
  WritableStreamDefaultController: WebStreamsPolyfill.WritableStreamDefaultController,
  TransformStreamDefaultController: WebStreamsPolyfill.TransformStreamDefaultController,
  
  // Strategies
  ByteLengthQueuingStrategy: WebStreamsPolyfill.ByteLengthQueuingStrategy,
  CountQueuingStrategy: WebStreamsPolyfill.CountQueuingStrategy
}; 