import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CharacterCanvas } from './CharacterCanvas';
import type { CharacterRig } from '../three/CharacterRig';
import type { AnimationPlan } from '../ai/types';
import { theme } from '../ui/theme';

export type CharacterCardHandle = {
  play: (plan: AnimationPlan) => Promise<void>;
};

type OwnProps = {
  onReady?: () => void;
  onProgress?: (progress: number) => void;
};

export const CharacterCard = forwardRef<CharacterCardHandle, OwnProps>(({ onReady, onProgress: onProgressProp }, ref) => {
  const rigRef = useRef<CharacterRig | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleReady = useCallback((rig: CharacterRig) => {
    rigRef.current = rig;
    setReady(true);
    onReady?.();
  }, [onReady]);

  const handleProgress = useCallback((loaded: number, total: number) => {
    if (total > 0) {
      const p = loaded / total;
      setProgress(p);
      onProgressProp?.(p);
    }
  }, [onProgressProp]);

  useImperativeHandle(ref, () => ({
    play: async (plan: AnimationPlan) => {
      const rig = rigRef.current;
      if (!rig) return;
      const action = plan.action;
      if (action === 'idle') {
        rig.mixer.timeScale = plan.mixerSpeed;
        return;
      }
      await rig.play(action, plan.mixerSpeed, plan.intensity);
    },
  }));

  return (
    <View style={styles.card}>
      <CharacterCanvas onReady={handleReady} onProgress={handleProgress} />
      {!ready && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.ink} />
          <Text style={styles.loadingText}>
            加载角色中… {progress > 0 ? `${Math.round(progress * 100)}%` : ''}
          </Text>
        </View>
      )}
    </View>
  );
});

CharacterCard.displayName = 'CharacterCard';

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceMuted,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
    color: theme.inkMuted,
  },
});
