import React from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { theme } from './theme';

type Props = {
  label: string;
  bg?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
};

// Soft pill chip used for inline status labels (e.g. "今日任务", "✓ 已完成").
export function Stamp({
  label,
  bg = theme.accentSoft,
  textColor = theme.accent,
  style,
}: Props) {
  return (
    <View style={[styles.body, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignSelf: 'flex-start',
    borderRadius: theme.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
