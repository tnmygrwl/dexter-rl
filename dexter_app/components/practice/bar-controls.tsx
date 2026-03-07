import { Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { PracticeState } from '@/hooks/use-practice-session';

interface BarControlsProps {
  state: PracticeState;
  onStart: () => void;
  onFinish: () => void;
  onNext: () => void;
  onRetry: () => void;
  isLastBar: boolean;
}

export function BarControls({
  state,
  onStart,
  onFinish,
  onNext,
  onRetry,
  isLastBar,
}: BarControlsProps) {
  if (state === 'done') {
    return (
      <View style={styles.container}>
        <View style={[styles.button, styles.doneButton]}>
          <ThemedText style={styles.doneText}>SESSION COMPLETE</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {state === 'idle' && (
        <Pressable
          style={({ pressed }) => [styles.button, styles.startButton, pressed && styles.pressed]}
          onPress={onStart}
        >
          <ThemedText style={styles.startText}>START BAR</ThemedText>
        </Pressable>
      )}

      {state === 'playing' && (
        <Pressable
          style={({ pressed }) => [styles.button, styles.finishButton, pressed && styles.pressed]}
          onPress={onFinish}
        >
          <ThemedText style={styles.finishText}>DONE</ThemedText>
        </Pressable>
      )}

      {state === 'saving' && (
        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.retryButton,
              styles.halfButton,
              pressed && styles.pressed,
            ]}
            onPress={onRetry}
          >
            <ThemedText style={styles.retryText}>RETRY</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.nextButton,
              styles.halfButton,
              pressed && styles.pressed,
            ]}
            onPress={onNext}
          >
            <ThemedText style={styles.nextText}>
              {isLastBar ? 'FINISH' : 'NEXT BAR'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  halfButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  startButton: {
    backgroundColor: Colors.dark.amber,
  },
  startText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  finishButton: {
    backgroundColor: Colors.dark.green,
  },
  finishText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  nextButton: {
    backgroundColor: Colors.dark.amber,
  },
  nextText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  retryButton: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  doneButton: {
    backgroundColor: Colors.dark.green,
  },
  doneText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
