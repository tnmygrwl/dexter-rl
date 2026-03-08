import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import { StageCard } from '@/components/ui/stage-card';
import { BarHeader } from '@/components/practice/bar-header';
import { BarTabView } from '@/components/practice/bar-tab-view';
import { CameraFeed } from '@/components/practice/camera-feed';
import { LiveMetrics } from '@/components/practice/live-metrics';
import { CoachingToast } from '@/components/practice/coaching-toast';
import { BarControls } from '@/components/practice/bar-controls';
import { useSession } from '@/context/session-context';
import { usePracticeSession } from '@/hooks/use-practice-session';
import { dlog } from '@/utils/debug-log';

export default function PracticeScreen() {
  const { tabData } = useSession();
  const practice = usePracticeSession();

  const handleStart = useCallback(async () => {
    dlog.info('PracticeUI', 'Start button pressed');
    practice.startBar();
  }, [practice]);

  if (!tabData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.emptyContainer}>
          <LedText size="lg" style={styles.title}>PRACTICE</LedText>
          <StageCard style={styles.emptyCard}>
            <ThemedText style={styles.emptyText}>
              Select a song from the Setup tab to begin practicing.
            </ThemedText>
          </StageCard>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = practice.state === 'playing';
  const isLastBar = practice.currentBarIndex >= practice.totalBars - 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.content}>
          <BarHeader
            barIndex={practice.currentBarIndex}
            totalBars={practice.totalBars}
            section={practice.currentSection}
            chords={practice.currentChords}
            tempo={tabData.metadata.tempo}
          />

          <BarTabView
            notes={practice.currentBarNotes}
            timeSignature={tabData.metadata.timeSignature}
          />

          <View style={styles.spacer} />

          {/* Coaching text cue — right above the metric bars */}
          <CoachingToast feedback={practice.latestFeedback} />

          <View style={styles.spacerSmall} />

          {/* Live metrics — hero UI */}
          <LiveMetrics metrics={practice.liveMetrics} isActive={isActive} />

          {practice.error && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{practice.error}</ThemedText>
            </View>
          )}
        </View>

        {/* Camera PiP — floating in bottom-right corner */}
        <View style={styles.cameraPip}>
          <CameraFeed isActive={isActive} />
        </View>

        <BarControls
          state={practice.state === 'connecting' ? 'idle' : practice.state}
          onStart={handleStart}
          onFinish={practice.finishBar}
          onNext={practice.nextBar}
          onRetry={practice.retryBar}
          isLastBar={isLastBar}
        />
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
  },
  content: {
    flex: 1,
    paddingBottom: 8,
  },
  emptyContainer: {
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
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  spacer: {
    height: 10,
  },
  spacerSmall: {
    height: 6,
  },
  cameraPip: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.red,
  },
  errorText: {
    color: Colors.dark.red,
    fontSize: 13,
  },
});
