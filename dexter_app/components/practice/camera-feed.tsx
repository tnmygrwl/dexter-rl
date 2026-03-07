import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { dlog } from '@/utils/debug-log';

const TAG = 'CameraFeed';

interface CameraFeedProps {
  isActive: boolean;
}

export function CameraFeed({ isActive }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isActive) {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [isActive]);

  async function startCamera() {
    if (Platform.OS !== 'web') return;
    try {
      dlog.info(TAG, 'Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      setHasPermission(true);
      dlog.info(TAG, 'Camera stream acquired');

      // Attach to video element after render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      dlog.error(TAG, `Camera access denied: ${err}`);
      setHasPermission(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // Web: render a real <video> element
  if (Platform.OS === 'web') {
    if (!isActive) {
      return (
        <View style={styles.container}>
          <ThemedText style={styles.offText}>CAMERA OFF</ThemedText>
          <ThemedText style={styles.subText}>Tap Start to begin</ThemedText>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.container}>
          <ThemedText style={styles.errorText}>Camera blocked</ThemedText>
          <ThemedText style={styles.subText}>Allow camera access in browser</ThemedText>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.activeBorder]}>
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <ThemedText style={styles.liveLabel}>LIVE</ThemedText>
        </View>
        {/* @ts-ignore — RNW supports native HTML elements */}
        <video
          ref={videoRef as any}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 10,
            transform: 'scaleX(-1)',
          }}
        />
      </View>
    );
  }

  // Native: placeholder (LiveKit handles tracks)
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
    width: '100%' as any,
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeBorder: {
    borderColor: Colors.dark.green,
  },
  recordingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.red,
  },
  liveLabel: {
    color: Colors.dark.red,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveContainer: {
    alignItems: 'center',
    gap: 6,
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
    marginTop: 2,
  },
  offText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.red,
    fontSize: 12,
    fontWeight: '600',
  },
});
