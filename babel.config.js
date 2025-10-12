module.exports = function(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // module-resolver plugin removed as aliasing is handled in metro.config.js
      'react-native-paper/babel',
      '@babel/plugin-transform-class-static-block'
    ]
  };
};