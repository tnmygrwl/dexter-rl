import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import type { SongSection } from '@/types/tab';

interface BarHeaderProps {
  barIndex: number;
  totalBars: number;
  section: SongSection | null;
  chords: string[];
  tempo: number;
}

export function BarHeader({ barIndex, totalBars, section, chords, tempo }: BarHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <LedText size="lg">BAR {barIndex + 1}</LedText>
        <ThemedText style={styles.ofTotal}>of {totalBars}</ThemedText>
        <View style={styles.spacer} />
        <LedText size="sm">{tempo} BPM</LedText>
      </View>

      <View style={styles.bottomRow}>
        {section && (
          <View style={styles.sectionBadge}>
            <ThemedText style={styles.sectionText}>{section.name}</ThemedText>
          </View>
        )}
        {chords.length > 0 && (
          <View style={styles.chordRow}>
            {chords.map((chord, i) => (
              <LedText key={i} size="sm" style={styles.chord}>
                {chord}
              </LedText>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  ofTotal: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  spacer: {
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionBadge: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  chordRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chord: {
    color: Colors.dark.amber,
  },
});
