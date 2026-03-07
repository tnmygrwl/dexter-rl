import { StyleSheet, Text, type TextProps } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface LedTextProps extends TextProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LedText({
  style,
  color = Colors.dark.amber,
  size = 'md',
  ...props
}: LedTextProps) {
  return (
    <Text
      style={[
        styles.base,
        size === 'sm' ? styles.sm : undefined,
        size === 'md' ? styles.md : undefined,
        size === 'lg' ? styles.lg : undefined,
        { color },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts?.mono,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  sm: {
    fontSize: 12,
    lineHeight: 16,
  },
  md: {
    fontSize: 16,
    lineHeight: 22,
  },
  lg: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
});
