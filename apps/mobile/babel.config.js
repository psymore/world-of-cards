module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4's worklet transform (moved to react-native-worklets as of
    // Reanimated 4) must be listed last — added for the ADR-002 migration
    // (docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md).
    // Mirrors apps/playground/babel.config.js exactly.
    plugins: ['react-native-worklets/plugin'],
  };
};
