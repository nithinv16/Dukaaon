
'use strict';

// This is a patched version that uses stream-browserify instead of Node.js stream
const Stream = require('stream-browserify');

/**
 * Emits the `'close'` event on a stream.
 *
 * @param {Stream.Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * Creates a duplex stream.
 *
 * @param {WebSocket} ws The WebSocket instance
 * @param {Object} options The options for the duplex stream
 * @returns {Stream.Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let resumeOnReceiverDrain = true;
  let terminateOnDestroy = true;

  function receiverOnDrain() {
    if (resumeOnReceiverDrain) ws._socket.resume();
  }

  if (ws.readyState === ws.CONNECTING) {
    resumeOnReceiverDrain = false;
    ws.once('open', function open() {
      resumeOnReceiverDrain = true;
      if (stream.readable) ws.receiver.on('drain', receiverOnDrain);
    });
  } else {
    if (ws.receiver) ws.receiver.on('drain', receiverOnDrain);
  }

  const stream = new Stream.Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg, isBinary) {
    const data = !isBinary && stream._readableState.objectMode ? msg : msg;

    if (!stream.push(data)) ws._socket.pause();
  });

  ws.once('error', function error(err) {
    if (stream.destroyed) return;

    stream.destroy(err);
  });

  ws.once('close', function close() {
    if (stream.destroyed) return;

    stream.push(null);
  });

  stream._read = function read() {
    if (ws.receiver) ws._socket.resume();
  };

  stream._write = function write(chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._write(chunk, encoding, callback);
      });
      return;
    }

    try {
      const binary = !(chunk instanceof Buffer);
      const result = ws.send(chunk, { binary });
      
      if (typeof result !== 'undefined' && !result) {
        ws._sender.once('drain', callback);
        return;
      }
    } catch (error) {
      callback(error);
      return;
    }

    callback();
  };

  stream._final = function final(callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._final(callback);
      });
      return;
    }

    if (ws._socket === null) return callback();

    try {
      ws.close();
    } catch (error) {
      callback(error);
      return;
    }

    if (terminateOnDestroy) {
      const timeout = setTimeout(function() {
        callback(new Error('WebSocket was not closed within timeout'));
      }, 30 * 1000);

      ws.once('close', function close() {
        clearTimeout(timeout);
        callback();
      });
      return;
    }

    callback();
  };

  stream._destroy = function destroy(err, callback) {
    if (ws._socket === null) {
      callback(err);
      process.nextTick(emitClose, stream);
      return;
    }

    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._destroy(err, callback);
      });
      return;
    }

    if (terminateOnDestroy && ws.readyState !== ws.CLOSED) {
      const timeout = setTimeout(function() {
        callback(new Error('WebSocket was not closed within timeout'));
      }, 30 * 1000);

      ws.once('close', function close() {
        clearTimeout(timeout);
        callback(err);
        process.nextTick(emitClose, stream);
      });

      try {
        ws.terminate();
      } catch (e) {
        clearTimeout(timeout);
        callback(e);
        process.nextTick(emitClose, stream);
      }
      return;
    }

    callback(err);
    process.nextTick(emitClose, stream);
  };

  return stream;
}

module.exports = createWebSocketStream;
      