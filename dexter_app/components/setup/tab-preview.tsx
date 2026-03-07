import { Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import { MetadataBar } from './metadata-bar';
import { SectionList } from './section-list';
import { TabNotation } from './tab-notation';
import type { TabData } from '@/types/tab';

interface TabPreviewProps {
  tabData: TabData;
  onStartPractice?: () => void;
  onBack?: () => void;
}

export function TabPreview({ tabData, onStartPractice, onBack }: TabPreviewProps) {
  const { metadata, sections, rawText } = tabData;

  return (
    <View style={styles.container}>
      {/* Song title header */}
      <View style={styles.header}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <ThemedText style={styles.backText}>{'← Search'}</ThemedText>
          </Pressable>
        )}
        <View style={styles.titleBlock}>
          <LedText size="lg">{metadata.title}</LedText>
          <ThemedText style={styles.artist}>{metadata.artist}</ThemedText>
        </View>
      </View>

      <MetadataBar metadata={metadata} />

      <View style={styles.spacer} />

      <SectionList sections={sections} />

      <View style={styles.spacer} />

      <TabNotation rawText={rawText} />

      <View style={styles.spacer} />

      {/* Start Practice CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaPressed,
          ]}
          onPress={onStartPractice}
        >
          <ThemedText style={styles.ctaText}>START PRACTICE</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  backText: {
    color: Colors.dark.amber,
    fontSize: 14,
    fontWeight: '600',
  },
  titleBlock: {
    gap: 4,
  },
  artist: {
    color: Colors.dark.textMuted,
    fontSize: 16,
  },
  spacer: {
    height: 16,
  },
  ctaContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  ctaButton: {
    backgroundColor: Colors.dark.amber,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
