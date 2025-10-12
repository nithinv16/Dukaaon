/**
 * Patch for Expo Metro Runtime Web Streams issue
 * 
 * This file will be used by the module mapper to provide the required
 * web-streams-polyfill functionality to the Expo Metro Runtime
 */

// Import the base module instead of ponyfill directly
import * as WebStreamsPolyfill from 'web-streams-polyfill';

// Export the ReadableStream class directly, which is what Metro runtime needs
export const ReadableStream = WebStreamsPolyfill.ReadableStream;

// Export everything else for completeness
export const WritableStream = WebStreamsPolyfill.WritableStream;
export const TransformStream = WebStreamsPolyfill.TransformStream;
export const ByteLengthQueuingStrategy = WebStreamsPolyfill.ByteLengthQueuingStrategy;
export const CountQueuingStrategy = WebStreamsPolyfill.CountQueuingStrategy;

// Export default for ES6 module imports
export default {
  ReadableStream,
  WritableStream,
  TransformStream,
  ByteLengthQueuingStrategy,
  CountQueuingStrategy
}; 