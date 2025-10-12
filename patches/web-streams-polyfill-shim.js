/**
 * Web Streams Polyfill Shim
 * 
 * This file provides a simple shim/redirect for web-streams-polyfill
 * to solve resolution issues in Metro bundler
 */

import * as WebStreamsPolyfill from 'web-streams-polyfill';

// Re-export everything 
export default WebStreamsPolyfill;

// Also export individual components
export const ReadableStream = WebStreamsPolyfill.ReadableStream;
export const WritableStream = WebStreamsPolyfill.WritableStream;
export const TransformStream = WebStreamsPolyfill.TransformStream;

// ES6 specific exports
export const ReadableStreamDefaultReader = WebStreamsPolyfill.ReadableStreamDefaultReader;
export const ReadableStreamBYOBReader = WebStreamsPolyfill.ReadableStreamBYOBReader;
export const ReadableStreamDefaultController = WebStreamsPolyfill.ReadableStreamDefaultController;
export const WritableStreamDefaultWriter = WebStreamsPolyfill.WritableStreamDefaultWriter;
export const WritableStreamDefaultController = WebStreamsPolyfill.WritableStreamDefaultController;
export const TransformStreamDefaultController = WebStreamsPolyfill.TransformStreamDefaultController;

// Additional exports
export const ByteLengthQueuingStrategy = WebStreamsPolyfill.ByteLengthQueuingStrategy;
export const CountQueuingStrategy = WebStreamsPolyfill.CountQueuingStrategy; 