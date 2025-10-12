const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add polyfills
  if (!config.resolve.fallback) {
    config.resolve.fallback = {};
  }
  
  Object.assign(config.resolve.fallback, {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
    events: require.resolve('events'),
  });
  
  // Add plugins to provide polyfills
  if (!config.plugins) {
    config.plugins = [];
  }
  
  const webpack = require('webpack');
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );
  
  // Resolve process/browser to our custom implementation
  config.resolve.alias = {
    ...config.resolve.alias,
    'process/browser': path.resolve(__dirname, 'patches/process-browser.js'),
  };
  
  return config;
}; 