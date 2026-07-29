module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4's worklet transform (moved to react-native-worklets as of
    // Reanimated 4) must be listed last — added specifically for the Demo08
    // Reanimated experiment (see
    // docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md). apps/mobile has
    // its own, byte-identical babel.config.js as of ADR-002's migration.
    plugins: ['react-native-worklets/plugin'],
  };
};
