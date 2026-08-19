import { useEffect, useRef } from 'react';

// TEMPORARY DEBUG INSTRUMENTATION — see docs/domains/games/batak/known-issues.md
// "Animation stutter after several tricks" investigation. Not meant to survive the branch that
// added it. Logs JS-thread frame gaps (requestAnimationFrame deltas) tagged [BATAK-PERF] so a
// live logcat session can show whether the stutter is a JS-thread block (gap spikes) and whether
// it gets more frequent/severe over the course of a hand.
export function useFrameDropMonitor(label: string, enabled: boolean) {
  const lastRef = useRef<number | null>(null);
  const droppedCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function tick(now: number) {
      if (cancelled) return;
      frameCountRef.current += 1;
      if (lastRef.current != null) {
        const delta = now - lastRef.current;
        // Flag any frame gap worse than 2x the 60fps budget — a genuine dropped frame, not just
        // ordinary jitter.
        if (delta > 33) {
          droppedCountRef.current += 1;
          console.log(
            `[BATAK-PERF] ${label} frame gap ${delta.toFixed(1)}ms at frame #${frameCountRef.current} (dropped so far: ${droppedCountRef.current})`,
          );
        }
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    console.log(`[BATAK-PERF] ${label} frame monitor started`);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      console.log(
        `[BATAK-PERF] ${label} frame monitor stopped — ${droppedCountRef.current} drops over ${frameCountRef.current} frames`,
      );
    };
  }, [label, enabled]);
}
