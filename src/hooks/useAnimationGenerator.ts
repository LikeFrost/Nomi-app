import { useCallback } from 'react';
import type { ActionKind, AIOutput, AnimationPlan, EmotionState } from '../ai/types';
import { clamp } from '../utils/rng';

export function useAnimationGenerator() {
  return useCallback(
    (action: ActionKind, ai: AIOutput, state: EmotionState): AnimationPlan => {
      // Combined suppressor: low energy OR high boredom both pull the motion
      // down. Using max() instead of multiplying the two factors avoids
      // compounding into an unreachably small floor.
      const suppressor = Math.max(ai.boredom, 1 - state.energy);
      // Keep amplitude variation subtle — the dog should still look like it's
      // doing the action, just a bit smaller when drained/bored.
      const effective = clamp(ai.intensity * (1 - 0.35 * suppressor));

      // Speed carries most of the "tired vs energetic" expression. Floor at 0.4
      // (clearly slow-mo) so a drained dog visibly drags through the motion.
      const mixerSpeed = clamp(0.4 + ai.pace * 1.2, 0.4, 1.6);

      // When boredom is high and intensity is low, skip the action entirely
      // and stay on idle — this is the "barely reacts" path.
      const finalAction: AnimationPlan['action'] =
        ai.boredom > 0.7 && effective < 0.15 ? 'idle' : action;

      return {
        action: finalAction,
        emotion: ai.emotion,
        mixerSpeed,
        intensity: effective,
        mood: state.mood,
      };
    },
    [],
  );
}
