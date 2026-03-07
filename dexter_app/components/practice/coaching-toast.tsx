import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { GeminiFeedback } from '@/types/tab';

interface CoachingToastProps {
  feedback: GeminiFeedback | null;
}

export function CoachingToast({ feedback }: CoachingToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const currentText = useRef('');

  useEffect(() => {
    if (feedback?.feedback && feedback.feedback.trim().length > 0) {
      currentText.current = feedback.feedback;
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });

      // Auto-dismiss after 4 seconds
      opacity.value = withDelay(4000, withTiming(0, { duration: 300 }));
      translateY.value = withDelay(4000, withTiming(20, { duration: 300 }));
    }
  }, [feedback, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!feedback?.feedback) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.toast}>
        {feedback.detectedChord && (
          <View style={styles.chordRow}>
            <ThemedText style={styles.chordLabel}>
              Detected: <ThemedText style={styles.chordValue}>{feedback.detectedChord}</ThemedText>
            </ThemedText>
            {feedback.expectedChord && feedback.detectedChord !== feedback.expectedChord && (
              <ThemedText style={styles.chordExpected}>
                Expected: {feedback.expectedChord}
              </ThemedText>
            )}
          </View>
        )}
        <ThemedText style={styles.feedbackText}>{currentText.current}</ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  toast: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.amber,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  chordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chordLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  chordValue: {
    color: Colors.dark.amber,
    fontWeight: '700',
  },
  chordExpected: {
    fontSize: 12,
    color: Colors.dark.red,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
  },
});
