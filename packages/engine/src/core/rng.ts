export interface RngState {
  seed: number;
}

export interface RNG {
  next(): number;
  getState(): RngState;
}

export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    getState: () => ({ seed: state }),
  };
}

export function rngFromState(state: RngState): RNG {
  return createRng(state.seed);
}
