import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  id: number;
  emoji: string;
  angle: number;       // radians, 0 = right, -PI/2 = up
  distance: number;    // px to drift along the angle
  delay: number;       // ms before this particle starts
  lifeMs: number;      // total lifetime
  rotateEnd: number;   // degrees of rotation accumulated by end of life
  size: number;        // emoji font size
  onDone: (id: number) => void;
};

export const Particle = memo(function Particle({
  id,
  emoji,
  angle,
  distance,
  delay,
  lifeMs,
  rotateEnd,
  size,
  onDone,
}: Props) {
  const progress = useSharedValue(0);
  const doneRef = useRef(false);

  const handleDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(id);
  };

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(
        1,
        { duration: lifeMs, easing: Easing.out(Easing.quad) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(handleDone)();
        },
      ),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const dx = Math.cos(angle) * distance * t;
    // Float upward: angle's y component plus a constant upward drift.
    const dy = Math.sin(angle) * distance * t - 50 * t;
    const scale = t < 0.2 ? t * 5 : 1 - (t - 0.2) * 0.3;
    const opacity = t < 0.1 ? t * 10 : 1 - Math.max(0, (t - 0.7) / 0.3);
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale },
        { rotate: `${rotateEnd * t}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
