import { StyleSheet, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { StageCard } from '@/components/ui/stage-card';
import type { TabNote } from '@/types/tab';

interface BarTabViewProps {
  notes: TabNote[];
  timeSignature: [number, number];
}

const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export function BarTabView({ notes, timeSignature }: BarTabViewProps) {
  const beats = timeSignature[0];
  const columns = beats * 2;

  // Build a grid: 6 strings x N columns
  const grid: (string | null)[][] = Array.from({ length: 6 }, () =>
    Array(columns).fill(null),
  );

  for (const note of notes) {
    const row = note.string - 1;
    const col = Math.min(Math.round((note.beat - 1) * 2), columns - 1);
    if (row >= 0 && row < 6 && col >= 0 && col < columns) {
      grid[row][col] = String(note.fret);
    }
  }

  return (
    <StageCard style={styles.card}>
      {grid.map((row, stringIdx) => (
        <View key={stringIdx} style={styles.stringRow}>
          <ThemedText style={styles.stringName}>{STRING_NAMES[stringIdx]}</ThemedText>
          <ThemedText style={styles.separator}>|</ThemedText>
          {row.map((cell, colIdx) => (
            <ThemedText
              key={colIdx}
              style={[styles.cell, cell != null ? styles.cellActive : styles.cellEmpty]}
            >
              {cell ?? '-'}
            </ThemedText>
          ))}
          <ThemedText style={styles.separator}>|</ThemedText>
        </View>
      ))}
    </StageCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  stringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  stringName: {
    width: 16,
    fontFamily: Fonts?.mono,
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  separator: {
    fontFamily: Fonts?.mono,
    fontSize: 13,
    color: Colors.dark.border,
    marginHorizontal: 2,
  },
  cell: {
    flex: 1,
    fontFamily: Fonts?.mono,
    fontSize: 14,
    textAlign: 'center',
  },
  cellActive: {
    color: Colors.dark.amber,
    fontWeight: '700',
  },
  cellEmpty: {
    color: Colors.dark.border,
  },
});
