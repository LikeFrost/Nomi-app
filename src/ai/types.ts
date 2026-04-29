export type ActionKind = 'greet' | 'kiss' | 'cheer';
export type Emotion = 'happy' | 'tired' | 'playful';

export type EmotionState = {
  mood: number;
  energy: number;
};

export type RecentAction = {
  action: ActionKind;
  at: number;
};

export type AIInput = {
  currentAction: ActionKind;
  recentActions: RecentAction[];
  clickFrequency: number;
  state: EmotionState;
};

export type AIOutput = {
  emotion: Emotion;
  pace: number;
  intensity: number;
  boredom: number;
};

export type AnimationPlan = {
  action: ActionKind | 'idle';   // 'idle' = bored, skip the action animation
  emotion: Emotion;
  mixerSpeed: number;            // 0.6 ~ 1.4, drives THREE.AnimationMixer.timeScale
  intensity: number;             // 0 ~ 1, drives action blend weight (0.5 ~ 1.0)
  mood: number;                  // 0 ~ 1, drives particle count (joy → more sparkles)
};
