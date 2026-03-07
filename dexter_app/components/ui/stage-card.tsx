import { StyleSheet, View, type ViewProps } from 'react-native';
import { Colors } from '@/constants/theme';

interface StageCardProps extends ViewProps {
  variant?: 'default' | 'elevated';
}

export function StageCard({ style, variant = 'default', ...props }: StageCardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' ? styles.elevated : styles.default,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  default: {
    backgroundColor: Colors.dark.surface,
  },
  elevated: {
    backgroundColor: Colors.dark.surfaceLight,
  },
});
