import { useCallback, useRef, useState } from 'react';
import { dlog } from '@/utils/debug-log';
import type { CameraView } from 'expo-camera';

const TAG = 'Camera';

interface UseCameraStreamOptions {
  onFrame: (base64: string) => void;
  fps?: number;
}

export function useCameraStream({ onFrame, fps = 1 }: UseCameraStreamOptions) {
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) {
      dlog.warn(TAG, 'captureFrame: cameraRef is null');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        shutterSound: false,
      });
      if (photo?.base64) {
        dlog.info(TAG, `Frame captured (${Math.round(photo.base64.length / 1024)}KB)`);
        onFrameRef.current(photo.base64);
      } else {
        dlog.warn(TAG, 'takePictureAsync returned no base64');
      }
    } catch (err) {
      dlog.warn(TAG, `captureFrame error: ${err}`);
    }
  }, []);

  const startStreaming = useCallback(() => {
    if (intervalRef.current) return;
    dlog.info(TAG, `Starting frame capture at ${fps}fps`);
    setIsStreaming(true);
    const intervalMs = Math.round(1000 / fps);
    intervalRef.current = setInterval(captureFrame, intervalMs);
  }, [captureFrame, fps]);

  const stopStreaming = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      dlog.info(TAG, 'Stopped frame capture');
    }
    setIsStreaming(false);
  }, []);

  return { cameraRef, isStreaming, startStreaming, stopStreaming };
}
