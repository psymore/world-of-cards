jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Required since App.tsx wraps its root in GestureHandlerRootView (ADR-002 migration,
// docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md) — without this, RNGH's
// native module isn't mocked and any test rendering App throws "install is not a function".
require('react-native-gesture-handler/jestSetup');

// Reanimated's own worklet/native-module layer isn't available under Jest's Node environment, and
// even its own documented mock.js transitively requires the native TurboModule — see
// __mocks__/react-native-reanimated.js for the hand-rolled replacement this picks up. Added for
// the same ADR-002 migration.
jest.mock('react-native-reanimated');
