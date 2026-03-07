import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import type { SongSection } from '@/types/tab';

interface SectionListProps {
  sections: SongSection[];
}

function SectionItem({ section }: { section: SongSection }) {
  const [expanded, setExpanded] = useState(false);
  const barRange = section.startBar === section.endBar
    ? `Bar ${section.startBar}`
    : `Bars ${section.startBar}–${section.endBar}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.sectionItem,
        pressed && styles.pressed,
      ]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <ThemedText style={styles.chevron}>
            {expanded ? '▾' : '▸'}
          </ThemedText>
          <ThemedText style={styles.sectionName}>{section.name}</ThemedText>
        </View>
        <ThemedText style={styles.barRange}>{barRange}</ThemedText>
      </View>

      {expanded && section.chords.length > 0 && (
        <View style={styles.chordRow}>
          {section.chords.map((chord, i) => (
            <View key={i} style={styles.chordBadge}>
              <LedText size="sm">{chord}</LedText>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export function SectionList({ sections }: SectionListProps) {
  if (sections.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="label" style={styles.heading}>SECTIONS</ThemedText>
      {sections.map((section, i) => (
        <SectionItem key={i} section={section} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  heading: {
    marginBottom: 8,
  },
  sectionItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    paddingVertical: 10,
  },
  pressed: {
    backgroundColor: Colors.dark.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    width: 16,
  },
  sectionName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  barRange: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  chordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginLeft: 24,
  },
  chordBadge: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
