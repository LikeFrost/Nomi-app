import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActionKind } from '../ai/types';
import { theme } from '../ui/theme';

type Props = {
  onAction: (action: ActionKind) => void;
  disabled?: boolean;
};

const BUTTONS: Array<{
  key: ActionKind;
  label: string;
  icon: string;
  bg: string;
  fg: string;
}> = [
  { key: 'greet', label: '打招呼', icon: '👋', bg: theme.mutedSoft, fg: theme.muted },
  { key: 'kiss', label: '飞吻', icon: '💋', bg: '#E295B8', fg: theme.white },
  { key: 'cheer', label: '加油', icon: '🎉', bg: theme.ctaSoft, fg: theme.cta },
];

export function ActionButtons({ onAction, disabled }: Props) {
  return (
    <View style={styles.row}>
      {BUTTONS.map((b) => (
        <Pressable
          key={b.key}
          onPress={() => onAction(b.key)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: b.bg },
            pressed && styles.btnPressed,
            disabled && styles.btnDisabled,
          ]}
        >
          <Text style={styles.icon}>{b.icon}</Text>
          <Text style={[styles.label, { color: b.fg }]}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: theme.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // Raised 3D look: top highlight + bottom shadow edge
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.10)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(0, 0, 0, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
    }),
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  btnDisabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
