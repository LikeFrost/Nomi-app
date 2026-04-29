import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../ui/theme';

type Props = {
  count: number;
};

export function Header({ count }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        今日已给 <Text style={styles.count}>{count}</Text> 次反应
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.inkMuted,
  },
  count: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.ink,
    fontVariant: ['tabular-nums'],
  },
});
