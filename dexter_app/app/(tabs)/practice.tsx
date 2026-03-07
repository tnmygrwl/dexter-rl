import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from 'expo-audio';

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
import { DebugLog } from '@/components/practice/debug-log';
import { useSession } from '@/context/session-context';
import { usePracticeSession } from '@/hooks/use-practice-session';
import { useCameraStream } from '@/hooks/use-camera-stream';
import { useAudioStream } from '@/hooks/use-audio-stream';
import { dlog } from '@/utils/debug-log';

export default function PracticeScreen() {
  const { tabData } = useSession();
  const [audioGranted, setAudioGranted] = useState(false);

  const practice = usePracticeSession();

  const camera = useCameraStream({
    onFrame: practice.sendFrame,
    fps: 1,
  });

  const audio = useAudioStream({
    onAudioChunk: practice.sendAudio,
    chunkIntervalMs: 2000,
  });

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((res) => {
        setAudioGranted(res.granted);
        dlog.info('PracticeUI', `Audio permission: ${res.granted ? 'granted' : 'denied'}`);
      })
      .catch((err) => dlog.warn('PracticeUI', `Audio perm check failed: ${err}`));
  }, []);

  useEffect(() => {
    dlog.info('PracticeUI', `State changed → ${practice.state}`);
    if (practice.state === 'playing') {
      camera.startStreaming();
      if (audioGranted) {
        audio.startRecording();
      } else {
        dlog.warn('PracticeUI', 'Audio not granted, skipping mic recording');
      }
    } else {
      camera.stopStreaming();
      audio.stopRecording();
    }
  }, [practice.state]);

  const handleStart = useCallback(async () => {
    dlog.info('PracticeUI', 'Start button pressed');
    if (!audioGranted) {
      dlog.info('PracticeUI', 'Requesting audio permission...');
      const res = await requestRecordingPermissionsAsync();
      setAudioGranted(res.granted);
      dlog.info('PracticeUI', `Audio permission result: ${res.granted}`);
    }
    practice.startBar();
  }, [audioGranted, practice]);

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
        <DebugLog />
      </SafeAreaView>
    );
  }

  const isPlaying = practice.state === 'playing';
  const isLastBar = practice.currentBarIndex >= practice.totalBars - 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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

          <View style={styles.middleRow}>
            <CameraFeed
              cameraRef={camera.cameraRef}
              isActive={isPlaying}
            />
            <View style={styles.metricsWrapper}>
              <LiveMetrics metrics={practice.liveMetrics} isActive={isPlaying} />
            </View>
          </View>

          <View style={styles.spacer} />

          {practice.error && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{practice.error}</ThemedText>
            </View>
          )}
        </ScrollView>

        <CoachingToast feedback={practice.latestFeedback} />

        <BarControls
          state={practice.state}
          onStart={handleStart}
          onFinish={practice.finishBar}
          onNext={practice.nextBar}
          onRetry={practice.retryBar}
          isLastBar={isLastBar}
        />

        <DebugLog />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
    height: 12,
  },
  middleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricsWrapper: {
    flex: 1,
  },
  errorContainer: {
    marginHorizontal: 16,
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
