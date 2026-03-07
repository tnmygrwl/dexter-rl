import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import { StageCard } from '@/components/ui/stage-card';

export default function ReviewScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <LedText size="lg" style={styles.title}>REVIEW</LedText>
        <StageCard style={styles.card}>
          <ThemedText style={styles.placeholder}>
            Complete a practice session to see your performance review.
          </ThemedText>
          <View style={styles.previewLayout}>
            <View style={styles.previewBox}>
              <ThemedText type="label">SONG HEATMAP</ThemedText>
            </View>
            <View style={styles.previewBox}>
              <ThemedText type="label">WORST MOMENTS REPLAY</ThemedText>
            </View>
          </View>
        </StageCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Fonts?.mono,
    letterSpacing: 4,
  },
  card: {
    gap: 16,
  },
  placeholder: {
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  previewLayout: {
    gap: 8,
  },
  previewBox: {
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.inputBackground,
  },
});
