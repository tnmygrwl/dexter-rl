import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { dlog } from '@/utils/debug-log';

const TAG = 'CameraFeed';

interface CameraFeedProps {
  isActive: boolean;
}

export interface CameraFeedHandle {
  captureFrame: () => string | null;
}

export const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(
  function CameraFeed({ isActive }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        if (Platform.OS !== 'web' || !videoRef.current || !canvasRef.current) return null;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0) return null;
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, 320, 240);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        // Strip the data:image/jpeg;base64, prefix
        return dataUrl.split(',')[1] ?? null;
      },
    }));

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
          video: { facingMode: 'environment', width: 320, height: 240 },
          audio: false,
        });
        streamRef.current = stream;
        setHasPermission(true);
        dlog.info(TAG, 'Camera stream acquired');

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

    if (Platform.OS === 'web') {
      if (!isActive) {
        return (
          <View style={styles.container}>
            <ThemedText style={styles.offText}>CAM</ThemedText>
          </View>
        );
      }

      if (hasPermission === false) {
        return (
          <View style={[styles.container, styles.activeBorder]}>
            <ThemedText style={styles.errorText}>No cam</ThemedText>
          </View>
        );
      }

      return (
        <View style={[styles.container, styles.activeBorder]}>
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
          </View>
          {/* @ts-ignore */}
          <video
            ref={videoRef as any}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 8,
              transform: 'scaleX(-1)',
            }}
          />
          {/* Hidden canvas for frame capture */}
          {/* @ts-ignore */}
          <canvas ref={canvasRef as any} style={{ display: 'none' }} />
        </View>
      );
    }

    return (
      <View style={[styles.container, isActive && styles.activeBorder]}>
        <ThemedText style={styles.offText}>{isActive ? 'LIVE' : 'CAM'}</ThemedText>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 105,
    borderRadius: 8,
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
  recordingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.red,
  },
  offText: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.red,
    fontSize: 10,
    fontWeight: '600',
  },
});
