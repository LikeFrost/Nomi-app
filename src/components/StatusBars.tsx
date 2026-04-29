import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EmotionState } from '../ai/types';
import { theme } from '../ui/theme';

type Props = {
  state: EmotionState;
  onReset?: () => void;
};

export function StatusBars({ state, onReset }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.bars}>
        <Bar label="心情" value={state.mood} fill={theme.moodFill} />
        <Bar label="精力" value={state.energy} fill={theme.energyFill} />
      </View>
      {onReset ? (
        <Pressable
          onPress={onReset}
          hitSlop={8}
          style={({ pressed }) => [styles.reset, pressed && styles.resetPressed]}
        >
          <Text style={styles.resetText}>重置</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Bar({
  label,
  value,
  fill,
}: {
  label: string;
  value: number;
  fill: string;
}) {
  const ratio = Math.max(0, Math.min(1, value));
  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.barRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
      <Text style={styles.value}>{pct}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bars: {
    flex: 1,
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 28,
    fontSize: 11,
    fontWeight: '500',
    color: theme.inkMuted,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: theme.radiusPill,
    backgroundColor: theme.trackBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radiusPill,
  },
  value: {
    width: 24,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '600',
    color: theme.inkSubtle,
    fontVariant: ['tabular-nums'],
  },
  reset: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radiusPill,
    backgroundColor: theme.surfaceMuted,
  },
  resetPressed: {
    backgroundColor: theme.trackBg,
  },
  resetText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.inkMuted,
  },
});
