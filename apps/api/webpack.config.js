const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      // Allow webpack to resolve .js imports as .ts when bundling workspace packages.
      // @la-grieta/r2 uses ESM-style explicit .js extensions in its TS source.
      extensionAlias: {
        '.js': ['.ts', '.js'],
      },
    },
    externals: [
      nodeExternals({
        // Bundle workspace packages instead of externalizing them
        allowlist: [/@la-grieta\/.*/],
      }),
    ],
  };
};
