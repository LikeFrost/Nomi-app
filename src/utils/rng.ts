export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
