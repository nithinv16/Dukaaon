/**
 * Jest-only Babel plugin: rewrite `import('x')` to `Promise.resolve().then(() => require('x'))`.
 *
 * Jest runs modules in a VM without `--experimental-vm-modules`, so a native
 * `import()` left in the transformed output throws
 * `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`. `babel-preset-expo` keeps
 * `import()` native (Metro handles it), which means any test that exercises a
 * code path using `await import(...)` — for example the multi-seller branch of
 * `app/(main)/checkout/index.tsx` — fails before reaching its assertions.
 *
 * Applied under `env.test` only, so Metro, EAS and release builds are untouched.
 */
const dynamicImportToRequireForJest = ({ types: t }) => ({
  name: 'dynamic-import-to-require-for-jest',
  visitor: {
    CallExpression(path) {
      if (!t.isImport(path.node.callee)) return;
      path.replaceWith(
        t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
              []
            ),
            t.identifier('then')
          ),
          [
            t.arrowFunctionExpression(
              [],
              t.callExpression(t.identifier('require'), path.node.arguments)
            ),
          ]
        )
      );
    },
  },
});

module.exports = function(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // module-resolver plugin removed as aliasing is handled in metro.config.js
      'react-native-paper/babel',
      '@babel/plugin-transform-class-static-block'
      // Note: Console log removal is handled by ProGuard in release builds
    ],
    env: {
      test: {
        plugins: [dynamicImportToRequireForJest]
      }
    }
  };
};
