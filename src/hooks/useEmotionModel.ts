import { useCallback, useEffect, useRef, useState } from 'react';
import { readJSON, writeJSON } from '../utils/storage';
import { clamp } from '../utils/rng';
import type { ActionKind, EmotionState } from '../ai/types';

const STORAGE_KEY = 'emotion_state';

type Stored = EmotionState & { updatedAt: number };

const NEUTRAL: Stored = { mood: 0.5, energy: 1.0, updatedAt: 0 };

// Signed raw deltas. Effective per-tap shift is shaped by saturation in
// applySaturatedDelta: gains slow near 1, drains slow near 0.
const ACTION_DELTAS: Record<ActionKind, EmotionState> = {
  greet: { mood: 0.18, energy: -0.08 },
  kiss: { mood: 0.25, energy: -0.06 },
  cheer: { mood: 0.18, energy: -0.20 },
};

const ENERGY_BASELINE = 1.0;
const MOOD_BASELINE = 0.5;
const ENERGY_TAU_SEC = 180;
const MOOD_TAU_SEC = 300;
const TICK_INTERVAL_MS = 5000;
const RENDER_THRESHOLD = 0.005;

function applySaturatedDelta(value: number, delta: number): number {
  const headroom = delta >= 0 ? 1 - value : value;
  return clamp(value + delta * headroom);
}

function decay(state: EmotionState, elapsedMs: number): EmotionState {
  if (elapsedMs <= 0) return state;
  const elapsedSec = elapsedMs / 1000;
  const energy =
    state.energy + (ENERGY_BASELINE - state.energy) * (1 - Math.exp(-elapsedSec / ENERGY_TAU_SEC));
  // mood drift is dampened when energy is low — a tired dog cheers up slowly.
  const moodPull = (1 - Math.exp(-elapsedSec / MOOD_TAU_SEC)) * (0.5 + 0.5 * state.energy);
  const mood = state.mood + (MOOD_BASELINE - state.mood) * moodPull;
  return {
    mood: clamp(mood),
    energy: clamp(energy),
  };
}

function diffExceeds(a: EmotionState, b: EmotionState, threshold: number): boolean {
  return Math.abs(a.mood - b.mood) > threshold || Math.abs(a.energy - b.energy) > threshold;
}

function neutralState(): EmotionState {
  return { mood: NEUTRAL.mood, energy: NEUTRAL.energy };
}

export function useEmotionModel() {
  const [state, setState] = useState<EmotionState>(neutralState);
  const stateRef = useRef(state);
  const lastDecayAtRef = useRef(Date.now());
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await readJSON<Stored>(STORAGE_KEY, NEUTRAL);
      const now = Date.now();
      const elapsedMs = stored.updatedAt ? now - stored.updatedAt : 0;
      const seed: EmotionState = { mood: stored.mood, energy: stored.energy };
      const decayed = decay(seed, elapsedMs);
      stateRef.current = decayed;
      lastDecayAtRef.current = now;
      setState(decayed);
    })();
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  // Recursive idle ticker so bars keep moving without user input.
  // setTimeout (not setInterval) avoids a backlog when the app is backgrounded.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsedMs = now - lastDecayAtRef.current;
      const next = decay(stateRef.current, elapsedMs);
      lastDecayAtRef.current = now;
      const shouldRender = diffExceeds(next, stateRef.current, RENDER_THRESHOLD);
      stateRef.current = next;
      if (shouldRender) setState(next);
      tickTimer.current = setTimeout(tick, TICK_INTERVAL_MS);
    };
    tickTimer.current = setTimeout(tick, TICK_INTERVAL_MS);
    return () => {
      if (tickTimer.current) clearTimeout(tickTimer.current);
    };
  }, []);

  const schedulePersist = useCallback((next: EmotionState) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeJSON<Stored>(STORAGE_KEY, { ...next, updatedAt: Date.now() }).catch(() => {});
    }, 300);
  }, []);

  const onAction = useCallback(
    (action: ActionKind) => {
      const now = Date.now();
      const elapsedMs = now - lastDecayAtRef.current;
      const decayed = decay(stateRef.current, elapsedMs);
      const delta = ACTION_DELTAS[action];
      const next: EmotionState = {
        mood: applySaturatedDelta(decayed.mood, delta.mood),
        energy: applySaturatedDelta(decayed.energy, delta.energy),
      };
      lastDecayAtRef.current = now;
      stateRef.current = next;
      setState(next);
      schedulePersist(next);
      return next;
    },
    [schedulePersist],
  );

  const reset = useCallback(() => {
    const next = neutralState();
    lastDecayAtRef.current = Date.now();
    stateRef.current = next;
    setState(next);
    schedulePersist(next);
  }, [schedulePersist]);

  return { state, stateRef, onAction, reset };
}
