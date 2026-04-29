import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Header } from './src/components/Header';
import { CharacterCard, type CharacterCardHandle } from './src/components/CharacterCard';
import { ActionButtons } from './src/components/ActionButtons';
import { StatusBars } from './src/components/StatusBars';
import { useDailyCounter } from './src/hooks/useDailyCounter';
import { useEmotionModel } from './src/hooks/useEmotionModel';
import { useAIState } from './src/hooks/useAIState';
import { useAnimationGenerator } from './src/hooks/useAnimationGenerator';
import type { ActionKind } from './src/ai/types';
import { Card } from './src/ui/Card';
import { theme } from './src/ui/theme';
import { SplashOverlay } from './src/components/SplashOverlay';

const EASTER_EGG_THRESHOLD = 4;
const EASTER_EGG_RAMP = 3; // clicks from threshold to fully visible

export default function App() {
  const { count, increment } = useDailyCounter();
  const {
    state: emotionState,
    onAction: bumpEmotion,
    reset: resetEmotion,
  } = useEmotionModel();
  const { recordAction, requestAIState } = useAIState();
  const generatePlan = useAnimationGenerator();
  const cardRef = useRef<CharacterCardHandle>(null);
  const lastClickAtRef = useRef(0);
  const [debouncing, setDebouncing] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [characterReady, setCharacterReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Easter-egg overlay opacity: hidden under threshold, fades up over the next
  // few clicks. Animated.timing smooths each step so the reveal isn't a step
  // function the user can read off.
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const target = Math.max(
      0,
      Math.min(1, (count - EASTER_EGG_THRESHOLD) / EASTER_EGG_RAMP),
    );
    Animated.timing(opacity, {
      toValue: target,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [count, opacity]);

  // No queue: each click fires its own state + AI + animation pipeline. The
  // rig pre-empts any in-flight action and cross-fades into the new one.
  // 500ms leading-edge throttle keeps mashing from melting the AI / particle /
  // mocap pipeline (and reads as "responsive but not spammable").
  const handleAction = useCallback(
    (action: ActionKind) => {
      const now = Date.now();
      if (now - lastClickAtRef.current < 500) return;
      lastClickAtRef.current = now;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setDebouncing(true);
      debounceTimerRef.current = setTimeout(() => setDebouncing(false), 500);
      increment();
      recordAction(action);
      const state = bumpEmotion(action);
      const ai = requestAIState(action, state);
      const plan = generatePlan(action, ai, state);
      cardRef.current?.play(plan).catch(() => {});
    },
    [increment, bumpEmotion, recordAction, requestAIState, generatePlan],
  );

  const easterEggUnlocked = count > EASTER_EGG_THRESHOLD;

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <Header count={count} />

        <View style={styles.stageWrap}>
          <Card elevation="md" style={styles.stagePanel}>
            <View style={styles.canvasFrame}>
              <CharacterCard
                ref={cardRef}
                onReady={() => setCharacterReady(true)}
              />
              <Animated.View
                pointerEvents={easterEggUnlocked ? 'box-none' : 'none'}
                style={[styles.bottomOverlay, { opacity }]}
              >
                <StatusBars state={emotionState} onReset={resetEmotion} />
              </Animated.View>
            </View>
          </Card>
        </View>

        <ActionButtons onAction={handleAction} disabled={debouncing} />
        <StatusBar style="dark" />

        {!splashDone && (
          <SplashOverlay
            ready={characterReady}
            onDone={() => setSplashDone(true)}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  stageWrap: {
    flex: 1,
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 18,
  },
  stagePanel: {
    flex: 1,
    overflow: 'hidden',
  },
  canvasFrame: {
    flex: 1,
    margin: 14,
    borderRadius: theme.radiusSm,
    backgroundColor: theme.surfaceMuted,
    overflow: 'hidden',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: theme.radiusSm,
  },
});
