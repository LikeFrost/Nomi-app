import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { theme } from './theme';

type Props = {
  elevation?: 'sm' | 'md' | 'lg';
  radius?: number;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const ELEVATION = {
  sm: { offsetY: 2, blur: 6, opacity: 0.04, android: 1 },
  md: { offsetY: 6, blur: 16, opacity: theme.shadowOpacity, android: 3 },
  lg: { offsetY: 12, blur: 28, opacity: 0.1, android: 6 },
} as const;

export function Card({
  elevation = 'md',
  radius = theme.radius,
  bg = theme.surface,
  style,
  children,
}: Props) {
  const e = ELEVATION[elevation];
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius,
          // Directional shadow + white highlight edge give a subtle lifted look.
          borderWidth: 1,
          borderColor: Platform.OS === 'android' ? 'transparent' : 'rgba(255, 255, 255, 0.85)',
          ...Platform.select({
            ios: {
              shadowColor: theme.shadowColor,
              shadowOpacity: e.opacity,
              shadowRadius: e.blur,
              shadowOffset: { width: 1.5, height: e.offsetY },
            },
            android: {
              elevation: e.android,
            },
            default: {},
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
});
