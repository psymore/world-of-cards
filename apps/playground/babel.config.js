module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4's worklet transform (moved to react-native-worklets as of
    // Reanimated 4) must be listed last — added specifically for the Demo08
    // Reanimated experiment (see
    // docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md). Playground-only;
    // apps/mobile has no babel.config.js of its own and does not need one, since it
    // has no Reanimated dependency.
    plugins: ['react-native-worklets/plugin'],
  };
};
