import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { dlog } from '@/utils/debug-log';
import {
  detectPitch,
  getAmplitude,
  getSpectralClarity,
  scorePitchAccuracy,
  scoreTimingFromAmplitude,
  getExpectedFrequencies,
} from '@/services/audio-analysis';
import type { TabNote } from '@/types/tab';

const TAG = 'AudioAnalysis';

export interface AudioMetrics {
  pitchAccuracy: number;
  timing: number;
  fingerPosition: number;
  detectedHz: number;
  amplitude: number;
  isPlaying: boolean;
}

interface UseAudioAnalysisOptions {
  expectedNotes: TabNote[];
  tempo: number;
  onMetrics: (metrics: AudioMetrics) => void;
}

export function useAudioAnalysis({ expectedNotes, tempo, onMetrics }: UseAudioAnalysisOptions) {
  const [isListening, setIsListening] = useState(false);
  const activeRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMetricsRef = useRef(onMetrics);
  onMetricsRef.current = onMetrics;
  const expectedNotesRef = useRef(expectedNotes);
  expectedNotesRef.current = expectedNotes;
  const beatCountRef = useRef(0);

  const startListening = useCallback(async () => {
    if (Platform.OS !== 'web') {
      dlog.warn(TAG, 'Audio analysis only supported on web');
      return;
    }
    if (activeRef.current) {
      dlog.warn(TAG, 'Already listening');
      return;
    }

    try {
      dlog.info(TAG, 'Requesting microphone for audio analysis...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      dlog.info(TAG, `Got mic stream: ${stream.getAudioTracks().length} audio tracks`);

      const ctx = new AudioContext();
      contextRef.current = ctx;

      // Resume AudioContext if it's suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        dlog.info(TAG, 'AudioContext is suspended, resuming...');
        await ctx.resume();
        dlog.info(TAG, `AudioContext state after resume: ${ctx.state}`);
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      activeRef.current = true;
      setIsListening(true);
      dlog.info(TAG, `Mic connected. Sample rate: ${ctx.sampleRate}, FFT: ${analyser.fftSize}, state: ${ctx.state}`);

      const beatIntervalMs = (60 / tempo) * 1000;
      beatCountRef.current = 0;
      let logCounter = 0;

      intervalRef.current = setInterval(() => {
        if (!analyserRef.current || !contextRef.current) return;
        if (contextRef.current.state !== 'running') return;

        const an = analyserRef.current;
        const sr = contextRef.current.sampleRate;

        const detectedHz = detectPitch(an, sr);
        const amplitude = getAmplitude(an);
        const clarity = getSpectralClarity(an);
        const isPlaying = amplitude > 0.015;

        // Log amplitude periodically so user can verify mic is working
        logCounter++;
        if (logCounter % 40 === 0) {
          dlog.info(TAG, `amp=${amplitude.toFixed(4)} hz=${detectedHz.toFixed(0)} playing=${isPlaying}`);
        }

        const expectedFreqs = getExpectedFrequencies(expectedNotesRef.current);
        const pitchScore = isPlaying ? scorePitchAccuracy(detectedHz, expectedFreqs) : 0;

        beatCountRef.current++;
        const elapsedMs = beatCountRef.current * 50;
        const beatPhase = (elapsedMs % beatIntervalMs) / beatIntervalMs;
        const isOnBeat = beatPhase < 0.15 || beatPhase > 0.85;
        const timingScore = isPlaying ? scoreTimingFromAmplitude(amplitude, isOnBeat) : 0;

        const metrics: AudioMetrics = {
          pitchAccuracy: pitchScore,
          timing: timingScore,
          fingerPosition: isPlaying ? clarity : 0,
          detectedHz,
          amplitude,
          isPlaying,
        };

        onMetricsRef.current(metrics);
      }, 50);

    } catch (err) {
      dlog.error(TAG, `Mic access failed: ${err}`);
    }
  }, [tempo]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    dlog.info(TAG, 'Stopped audio analysis');
  }, []);

  return { isListening, startListening, stopListening };
}
