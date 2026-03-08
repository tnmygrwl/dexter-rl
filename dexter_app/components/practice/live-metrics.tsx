import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { StageCard } from '@/components/ui/stage-card';
interface MetricsData {
  pitchAccuracy: number;
  timing: number;
  fingerPosition: number;
}

interface LiveMetricsProps {
  metrics: MetricsData;
  isActive: boolean;
}

interface MetricBarProps {
  label: string;
  value: number;
}

function MetricBar({ label, value }: MetricBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.5, 0.8, 1],
      [Colors.dark.red, Colors.dark.red, Colors.dark.amber, Colors.dark.green],
    ),
  }));

  const pct = Math.round(value * 100);

  return (
    <View style={styles.metricRow}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, fillStyle]} />
      </View>
      <ThemedText style={styles.metricValue}>{pct}%</ThemedText>
    </View>
  );
}

export function LiveMetrics({ metrics, isActive }: LiveMetricsProps) {
  return (
    <StageCard style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="label">LIVE METRICS</ThemedText>
        {isActive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>LIVE</ThemedText>
          </View>
        )}
      </View>

      <MetricBar label="PITCH" value={metrics.pitchAccuracy} />
      <MetricBar label="TIMING" value={metrics.timing} />
      <MetricBar label="FINGERS" value={metrics.fingerPosition} />
    </StageCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.red,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.red,
    letterSpacing: 1,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    width: 56,
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.dark.textMuted,
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.dark.inputBackground,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
    minWidth: 2,
  },
  metricValue: {
    width: 36,
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
