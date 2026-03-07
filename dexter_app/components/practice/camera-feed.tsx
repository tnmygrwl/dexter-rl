import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface CameraFeedProps {
  isActive: boolean;
}

/**
 * Placeholder for the camera PiP view.
 * LiveKit publishes the camera track directly — the video is sent
 * to the agent, not rendered locally as a preview by default.
 * A "LIVE" indicator shows when the session is active.
 */
export function CameraFeed({ isActive }: CameraFeedProps) {
  return (
    <View style={[styles.container, isActive && styles.activeBorder]}>
      {isActive ? (
        <View style={styles.liveContainer}>
          <View style={styles.recordingDot} />
          <ThemedText style={styles.liveText}>CAMERA ON</ThemedText>
          <ThemedText style={styles.subText}>Streaming to AI</ThemedText>
        </View>
      ) : (
        <ThemedText style={styles.offText}>CAM OFF</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBorder: {
    borderColor: Colors.dark.green,
  },
  liveContainer: {
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.red,
  },
  liveText: {
    color: Colors.dark.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subText: {
    color: Colors.dark.textMuted,
    fontSize: 10,
  },
  offText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
});
