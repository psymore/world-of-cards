// Manual Jest mock for react-native-reanimated. The package's own official mock (mock.js) still
// transitively imports the real `./index`, which initializes react-native-worklets' native
// TurboModule (`NativeWorklets.native.ts`'s `loadUnpackers`) — unavailable under Jest's Node test
// environment, so requiring it throws "Native part of Worklets doesn't seem to be initialized"
// even through the official mock. This hand-rolled replacement never touches that chain: shared
// values are plain mutable refs, `withTiming`/`withSpring`/etc. resolve synchronously (no native
// animation driver needed for a render/interaction test), and `Animated.View`/`Text`/`Image` are
// the plain React Native components, since by the time a style reaches them it's already a plain
// object. Added for the ADR-002 migration
// (docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md) — this file exists solely to
// let existing component tests render/interact correctly; it makes no claim about matching
// Reanimated's real animation timing or curves.

const React = require('react');
const { View, Text, Image } = require('react-native');

function interpolate(value, inputRange, outputRange) {
  if (value <= inputRange[0]) return outputRange[0];
  if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
  for (let i = 1; i < inputRange.length; i += 1) {
    if (value <= inputRange[i]) {
      const t = (value - inputRange[i - 1]) / (inputRange[i] - inputRange[i - 1]);
      return outputRange[i - 1] + t * (outputRange[i] - outputRange[i - 1]);
    }
  }
  return outputRange[outputRange.length - 1];
}

function useSharedValue(initial) {
  return React.useRef({ value: initial }).current;
}

function useAnimatedStyle(factory) {
  return factory();
}

function useAnimatedProps(factory) {
  return factory();
}

function useDerivedValue(factory) {
  return { value: factory() };
}

function withTiming(toValue) {
  return toValue;
}

function withSpring(toValue) {
  return toValue;
}

function withDelay(_delayMs, animation) {
  return animation;
}

function withSequence(...animations) {
  return animations[animations.length - 1];
}

function withRepeat(animation) {
  return animation;
}

function runOnJS(fn) {
  return fn;
}

function runOnUI(fn) {
  return fn;
}

function cancelAnimation() {}

function useAnimatedReaction() {}

// Used internally by react-native-gesture-handler's GestureDetector (useAnimatedGesture.ts) to
// build a native event handler ref. Tests never assert on real gesture-event-driven animation
// output, so an inert ref satisfies every real call site without needing worklet semantics.
function useEvent(_handler, _eventNames, _rebuild) {
  return React.useRef(null);
}

// Any Easing.<name>(...) call resolves to a plain identity curve — real curve shape is never
// asserted in these component-level tests, and (per this repo's migrated components) the easing
// value is only ever handed to withTiming, which this mock ignores entirely.
const identityEasing = (t) => t;
function easingProxyFn(...args) {
  if (args.length === 1 && typeof args[0] === 'number') return args[0];
  return identityEasing;
}
const Easing = new Proxy({}, { get: () => easingProxyFn });

function createAnimatedComponent(Component) {
  return Component;
}

const Animated = { View, Text, Image, createAnimatedComponent };

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  interpolate,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  useAnimatedReaction,
  useEvent,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  runOnUI,
  cancelAnimation,
  createAnimatedComponent,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
};
