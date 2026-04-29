import { useCallback, useRef } from 'react';
import { callLLM } from '../ai/llmClient';
import type { ActionKind, AIInput, AIOutput, EmotionState, RecentAction } from '../ai/types';
import { clamp, lerp } from '../utils/rng';

const HISTORY_MAX = 8;
const FREQ_WINDOW_MS = 5000;
const FAILURE_LIMIT = 3;
const COOLDOWN_MS = 30000;
const SMOOTH_T = 0.2;

function fallbackOutput(input: AIInput): AIOutput {
  const { state, recentActions, currentAction } = input;
  let emotion: AIOutput['emotion'];
  if (state.energy < 0.3) emotion = 'tired';
  else if (state.mood > 0.6) emotion = 'happy';
  else emotion = 'playful';

  const last5 = recentActions.slice(-5);
  const sameCount = last5.filter((a) => a.action === currentAction).length;
  const boredom = clamp(sameCount / 5);

  return {
    emotion,
    pace: clamp(state.energy),
    intensity: clamp(state.energy * state.mood + 0.25),
    boredom,
  };
}

function smooth(prev: AIOutput | null, next: AIOutput): AIOutput {
  if (!prev) return next;
  return {
    emotion: next.emotion,
    pace: lerp(prev.pace, next.pace, SMOOTH_T + 0.6),
    intensity: lerp(prev.intensity, next.intensity, SMOOTH_T + 0.6),
    boredom: lerp(prev.boredom, next.boredom, SMOOTH_T + 0.6),
  };
}

export function useAIState() {
  const historyRef = useRef<RecentAction[]>([]);
  const prevOutputRef = useRef<AIOutput | null>(null);
  const failuresRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const inflightRef = useRef<AbortController | null>(null);

  const recordAction = useCallback((action: ActionKind) => {
    const now = Date.now();
    historyRef.current = [...historyRef.current, { action, at: now }].slice(-HISTORY_MAX);
  }, []);

  // Returns synchronously with the latest cached AI output (or a fresh local
  // fallback). Kicks off a background LLM request that will update the cache
  // for the NEXT click — never blocks the animation.
  const requestAIState = useCallback(
    (action: ActionKind, state: EmotionState): AIOutput => {
      const now = Date.now();
      const recentActions = historyRef.current;
      const clickFrequency = recentActions.filter((a) => now - a.at < FREQ_WINDOW_MS).length;
      const input: AIInput = {
        currentAction: action,
        recentActions,
        clickFrequency,
        state,
      };

      // Immediate output: smooth(prev, fallback). This is what the animation
      // actually uses — guarantees no input lag.
      const fb = fallbackOutput(input);
      const immediate = smooth(prevOutputRef.current, fb);
      prevOutputRef.current = immediate;

      // Skip the LLM call if we're in cooldown.
      if (now < cooldownUntilRef.current) return immediate;

      // Fire-and-forget LLM call; result updates prevOutputRef for next time.
      if (inflightRef.current) inflightRef.current.abort();
      const controller = new AbortController();
      inflightRef.current = controller;

      callLLM(input, controller.signal)
        .then((aiResult) => {
          if (inflightRef.current === controller) inflightRef.current = null;
          if (!aiResult) {
            failuresRef.current += 1;
            if (failuresRef.current >= FAILURE_LIMIT) {
              cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
              failuresRef.current = 0;
            }
            return;
          }
          failuresRef.current = 0;
          // Smooth the AI result onto whatever prev is currently. Future clicks
          // will pick this up.
          prevOutputRef.current = smooth(prevOutputRef.current, aiResult);
        })
        .catch(() => {
          if (inflightRef.current === controller) inflightRef.current = null;
        });

      return immediate;
    },
    [],
  );

  return { recordAction, requestAIState };
}
