import { useCallback, useRef, useState } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { File as ExpoFile } from 'expo-file-system';
import { dlog } from '@/utils/debug-log';

const TAG = 'Audio';

interface UseAudioStreamOptions {
  onAudioChunk: (base64: string) => void;
  chunkIntervalMs?: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useAudioStream({
  onAudioChunk,
  chunkIntervalMs = 2000,
}: UseAudioStreamOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const onChunkRef = useRef(onAudioChunk);
  onChunkRef.current = onAudioChunk;

  const sendCurrentRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const file = new ExpoFile(uri);
        const buffer = await file.arrayBuffer();
        const b64 = arrayBufferToBase64(buffer);
        dlog.info(TAG, `Audio chunk: ${Math.round(b64.length / 1024)}KB from ${uri}`);
        onChunkRef.current(b64);
      } else {
        dlog.warn(TAG, 'No recording URI after stop');
      }
      if (recordingRef.current) {
        recorder.record();
      }
    } catch (err) {
      dlog.warn(TAG, `sendCurrentRecording error: ${err}`);
    }
  }, [recorder]);

  const startRecording = useCallback(async () => {
    dlog.info(TAG, 'Starting audio recording');
    recordingRef.current = true;
    setIsRecording(true);
    try {
      recorder.record();
      dlog.info(TAG, 'recorder.record() called');
    } catch (err) {
      dlog.error(TAG, `recorder.record() failed: ${err}`);
    }
    intervalRef.current = setInterval(sendCurrentRecording, chunkIntervalMs);
  }, [recorder, sendCurrentRecording, chunkIntervalMs]);

  const stopRecording = useCallback(async () => {
    dlog.info(TAG, 'Stopping audio recording');
    recordingRef.current = false;
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      await recorder.stop();
    } catch {
      // Already stopped
    }
  }, [recorder]);

  return { isRecording, startRecording, stopRecording };
}
