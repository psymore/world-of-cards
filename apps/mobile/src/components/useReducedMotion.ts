import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Whether the user has "reduce motion" enabled at the OS level (iOS/Android) or via
// prefers-reduced-motion (web, through react-native-web's AccessibilityInfo shim). Reusable by
// any game's card/table animations, not just Pişti's.
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isMounted) setReducedMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
