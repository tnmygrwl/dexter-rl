import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { GeminiFeedback } from '@/types/tab';

interface CoachingToastProps {
  feedback: GeminiFeedback | null;
}

export function CoachingToast({ feedback }: CoachingToastProps) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [chord, setChord] = useState<string | null>(null);
  const [expectedChord, setExpectedChord] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsgRef = useRef('');

  useEffect(() => {
    if (!feedback?.feedback || feedback.feedback.trim().length === 0) return;
    if (feedback.feedback === lastMsgRef.current) return;

    lastMsgRef.current = feedback.feedback;
    setText(feedback.feedback);
    setChord(feedback.detectedChord ?? null);
    setExpectedChord(feedback.expectedChord ?? null);
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 6000);
  }, [feedback]);

  if (!visible || !text) return null;

  return (
    <View style={styles.container}>
      <View style={styles.toast}>
        {chord && (
          <View style={styles.chordRow}>
            <ThemedText style={styles.chordLabel}>
              Detected: <ThemedText style={styles.chordValue}>{chord}</ThemedText>
            </ThemedText>
            {expectedChord && chord !== expectedChord && (
              <ThemedText style={styles.chordExpected}>
                Expected: {expectedChord}
              </ThemedText>
            )}
          </View>
        )}
        <ThemedText style={styles.feedbackText}>{text}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
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
