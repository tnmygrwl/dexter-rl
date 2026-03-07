import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import { StageCard } from '@/components/ui/stage-card';
import type { SongMetadata } from '@/types/tab';

interface MetadataBarProps {
  metadata: SongMetadata;
}

function MetadataCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.cell}>
      <ThemedText type="label">{label}</ThemedText>
      <LedText size="md" color={color}>{value}</LedText>
    </View>
  );
}

export function MetadataBar({ metadata }: MetadataBarProps) {
  const timeSig = `${metadata.timeSignature[0]}/${metadata.timeSignature[1]}`;
  const tuning = metadata.tuning.join(' ');

  return (
    <StageCard style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          <MetadataCell label="KEY" value={metadata.key} />
          <View style={styles.divider} />
          <MetadataCell label="BPM" value={String(metadata.tempo)} />
          <View style={styles.divider} />
          <MetadataCell label="TIME" value={timeSig} />
          <View style={styles.divider} />
          <MetadataCell label="TUNING" value={tuning} />
          <View style={styles.divider} />
          <MetadataCell label="CAPO" value={metadata.capo > 0 ? `Fret ${metadata.capo}` : 'None'} />
          <View style={styles.divider} />
          <MetadataCell
            label="DIFFICULTY"
            value={metadata.difficulty.toUpperCase()}
            color={
              metadata.difficulty === 'beginner'
                ? Colors.dark.green
                : metadata.difficulty === 'intermediate'
                  ? Colors.dark.amber
                  : Colors.dark.red
            }
          />
        </View>
      </ScrollView>
    </StageCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cell: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.dark.border,
  },
});
