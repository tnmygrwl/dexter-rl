import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { RefObject } from 'react';

interface CameraFeedProps {
  cameraRef: RefObject<CameraView | null>;
  isActive: boolean;
}

export function CameraFeed({ cameraRef, isActive }: CameraFeedProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View style={[styles.container, styles.placeholder]}>
        <ThemedText
          style={styles.permissionText}
          onPress={requestPermission}
        >
          Tap to enable camera
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      />
      {isActive && <View style={styles.recordingDot} />}
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
  },
  camera: {
    flex: 1,
  },
  placeholder: {
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    color: Colors.dark.amber,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  recordingDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.red,
  },
});
