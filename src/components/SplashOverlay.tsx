import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { theme } from '../ui/theme';

type Props = {
  ready: boolean;
  onDone: () => void;
};

export function SplashOverlay({ ready, onDone }: Props) {
  // Loading pulse rings
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  // Exit burst rings (expand once and vanish)
  const exit1 = useRef(new Animated.Value(0)).current;
  const exit2 = useRef(new Animated.Value(0)).current;

  const centerScale = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const pulseLoops = useRef<Animated.CompositeAnimation[]>([]);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    Animated.spring(centerScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    pulseLoops.current = [
      makePulse(ring1, 0),
      makePulse(ring2, 700),
    ];
    pulseLoops.current.forEach((l) => l.start());
    return () => pulseLoops.current.forEach((l) => l.stop());
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      pulseLoops.current.forEach((l) => l.stop());
      setExiting(true);

      // Heart fades out quickly
      Animated.timing(centerOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Rings expand slowly; overlay fades out mid-way so there's no white gap
      Animated.parallel([
        Animated.stagger(150, [exit1, exit2].map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        )),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [ready]);

  const pulseRingStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.0] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.15, 0] }),
  });

  const exitRingStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 5] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.2, 0] }),
  });

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.body}>
        {!exiting && (
          <>
            <Animated.View style={[styles.ring, pulseRingStyle(ring1)]} />
            <Animated.View style={[styles.ring, pulseRingStyle(ring2)]} />
          </>
        )}
        {exiting && (
          <>
            <Animated.View style={[styles.ring, exitRingStyle(exit1)]} />
            <Animated.View style={[styles.ring, exitRingStyle(exit2)]} />
          </>
        )}
        <Animated.View
          style={[
            styles.iconWrap,
            { transform: [{ scale: centerScale }], opacity: centerOpacity },
          ]}
        >
          <Text style={styles.icon}>♡</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const RING_SIZE = 180;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  body: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: {
    fontSize: 36,
    color: theme.accent,
  },
});
