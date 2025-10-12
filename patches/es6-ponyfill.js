/**
 * Direct alias for web-streams-polyfill/ponyfill/es6
 * Used to resolve metro runtime issues
 */

// Import the base module instead of ponyfill directly
const WebStreamsPolyfill = require('web-streams-polyfill');

// Create the exports manually
module.exports = {
  ReadableStream: WebStreamsPolyfill.ReadableStream,
  WritableStream: WebStreamsPolyfill.WritableStream,
  TransformStream: WebStreamsPolyfill.TransformStream,
  ByteLengthQueuingStrategy: WebStreamsPolyfill.ByteLengthQueuingStrategy,
  CountQueuingStrategy: WebStreamsPolyfill.CountQueuingStrategy,
  
  // Add any additional exports that might be needed
  ReadableStreamDefaultReader: WebStreamsPolyfill.ReadableStreamDefaultReader,
  ReadableStreamBYOBReader: WebStreamsPolyfill.ReadableStreamBYOBReader,
  ReadableStreamDefaultController: WebStreamsPolyfill.ReadableStreamDefaultController,
  WritableStreamDefaultWriter: WebStreamsPolyfill.WritableStreamDefaultWriter,
  WritableStreamDefaultController: WebStreamsPolyfill.WritableStreamDefaultController,
  TransformStreamDefaultController: WebStreamsPolyfill.TransformStreamDefaultController
}; 