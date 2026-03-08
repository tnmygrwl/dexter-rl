import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/context/session-context';
import { GEMINI_API_KEY } from '@/config';
import { getCoachingTip } from '@/services/gemini-coach';
import { useAudioAnalysis, type AudioMetrics } from '@/hooks/use-audio-analysis';
import { dlog } from '@/utils/debug-log';
import type { BarResult, GeminiFeedback, TabNote } from '@/types/tab';

const TAG = 'Practice';

export type PracticeState = 'idle' | 'connecting' | 'playing' | 'saving' | 'done';

export interface LiveMetrics {
  pitchAccuracy: number;
  timing: number;
  fingerPosition: number;
}

const EMPTY_METRICS: LiveMetrics = { pitchAccuracy: 0, timing: 0, fingerPosition: 0 };

const FALLBACK_TIPS = [
  'Keep your fretting fingers arched — avoid muting adjacent strings.',
  'Try to relax your picking hand. Tension kills speed.',
  'Listen to the riff in your head before you play it.',
  'Focus on clean transitions between power chords.',
  'Let the open strings ring out fully before moving to the next note.',
  'Your index finger should stay close to the fret wire.',
  'Remember: slow is smooth, smooth is fast.',
  'Good practice! Try to nail the rhythm before worrying about speed.',
];

function ema(prev: number, next: number, alpha = 0.15): number {
  return prev * (1 - alpha) + next * alpha;
}

export function usePracticeSession() {
  const { tabData, currentBarIndex, totalBars, addBarResult, advanceBar, setCurrentBarIndex } =
    useSession();
  const [state, setState] = useState<PracticeState>('idle');
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>(EMPTY_METRICS);
  const [latestFeedback, setLatestFeedback] = useState<GeminiFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const feedbackCountRef = useRef(0);
  const metricsAccRef = useRef({ pitch: 0, timing: 0, fingers: 0 });
  const startTimeRef = useRef(0);
  const coachingNotesRef = useRef<string[]>([]);
  const smoothMetricsRef = useRef({ pitch: 0, timing: 0, fingers: 0 });
  const coachingTickRef = useRef(0);
  const metricsTickRef = useRef(0);
  const lastDetectedHzRef = useRef(0);
  const coachingInFlightRef = useRef(false);
  const fallbackIdxRef = useRef(0);

  const currentBarNotes = useMemo((): TabNote[] => {
    if (!tabData) return [];
    const barNum = currentBarIndex + 1;
    return tabData.notes.filter((n) => n.bar === barNum);
  }, [tabData, currentBarIndex]);

  const currentSection = useMemo(() => {
    if (!tabData) return null;
    const barNum = currentBarIndex + 1;
    return tabData.sections.find((s) => barNum >= s.startBar && barNum <= s.endBar) ?? null;
  }, [tabData, currentBarIndex]);

  const currentChords = useMemo(() => {
    return currentSection?.chords ?? [];
  }, [currentSection]);

  const tempo = tabData?.metadata.tempo ?? 120;
  const currentChordsRef = useRef(currentChords);
  currentChordsRef.current = currentChords;

  const showCoaching = useCallback((msg: string) => {
    const sm = smoothMetricsRef.current;
    const fb: GeminiFeedback = {
      pitchAccuracy: sm.pitch,
      timing: sm.timing,
      fingerPosition: sm.fingers,
      detectedChord: null,
      expectedChord: currentChordsRef.current[0] ?? null,
      feedback: msg,
    };
    setLatestFeedback(fb);
    coachingNotesRef.current.push(msg);
  }, []);

  const requestGeminiCoaching = useCallback(async () => {
    if (!GEMINI_API_KEY || !tabData || coachingInFlightRef.current) return;
    coachingInFlightRef.current = true;
    const sm = smoothMetricsRef.current;

    try {
      const tip = await getCoachingTip({
        songTitle: tabData.metadata.title,
        artist: tabData.metadata.artist,
        barNumber: currentBarIndex + 1,
        totalBars,
        sectionName: currentSection?.name ?? 'Unknown',
        expectedChords: currentChordsRef.current,
        pitchAccuracy: sm.pitch,
        timing: sm.timing,
        fingerPosition: sm.fingers,
        detectedHz: lastDetectedHzRef.current,
      });
      if (tip) showCoaching(tip);
    } catch {
      // Silently fail — fallback tips will cover
    }
    coachingInFlightRef.current = false;
  }, [tabData, currentBarIndex, totalBars, currentSection, showCoaching]);

  const handleAudioMetrics = useCallback((am: AudioMetrics) => {
    metricsTickRef.current++;
    const sm = smoothMetricsRef.current;
    lastDetectedHzRef.current = am.detectedHz;

    if (am.isPlaying) {
      sm.pitch = ema(sm.pitch, am.pitchAccuracy);
      sm.timing = ema(sm.timing, am.timing);
      sm.fingers = ema(sm.fingers, am.fingerPosition);

      feedbackCountRef.current++;
      metricsAccRef.current.pitch += am.pitchAccuracy;
      metricsAccRef.current.timing += am.timing;
      metricsAccRef.current.fingers += am.fingerPosition;
    } else {
      sm.pitch = ema(sm.pitch, sm.pitch * 0.98, 0.05);
      sm.timing = ema(sm.timing, sm.timing * 0.98, 0.05);
      sm.fingers = ema(sm.fingers, sm.fingers * 0.98, 0.05);
    }

    setLiveMetrics({ pitchAccuracy: sm.pitch, timing: sm.timing, fingerPosition: sm.fingers });

    // Show coaching tips periodically (~every 4 seconds = 80 ticks at 50ms)
    coachingTickRef.current++;
    if (coachingTickRef.current % 80 === 0 && am.isPlaying) {
      if (GEMINI_API_KEY && !coachingInFlightRef.current) {
        requestGeminiCoaching();
      } else {
        const tip = FALLBACK_TIPS[fallbackIdxRef.current % FALLBACK_TIPS.length];
        fallbackIdxRef.current++;
        showCoaching(tip);
      }
    }

    if (metricsTickRef.current % 40 === 0) {
      dlog.info(TAG, `Metrics: pitch=${sm.pitch.toFixed(2)} timing=${sm.timing.toFixed(2)} fingers=${sm.fingers.toFixed(2)} amp=${am.amplitude.toFixed(4)} hz=${am.detectedHz.toFixed(0)}`);
    }
  }, [requestGeminiCoaching, showCoaching]);

  const audioAnalysis = useAudioAnalysis({
    expectedNotes: currentBarNotes,
    tempo,
    onMetrics: handleAudioMetrics,
  });

  const startListeningRef = useRef(audioAnalysis.startListening);
  startListeningRef.current = audioAnalysis.startListening;
  const stopListeningRef = useRef(audioAnalysis.stopListening);
  stopListeningRef.current = audioAnalysis.stopListening;

  const startBar = useCallback(async () => {
    dlog.info(TAG, `startBar() – bar ${currentBarIndex + 1} of ${totalBars}`);

    stopListeningRef.current();

    setError(null);
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
    feedbackCountRef.current = 0;
    metricsAccRef.current = { pitch: 0, timing: 0, fingers: 0 };
    smoothMetricsRef.current = { pitch: 0.5, timing: 0.5, fingers: 0.5 };
    coachingNotesRef.current = [];
    coachingTickRef.current = 0;
    metricsTickRef.current = 0;
    fallbackIdxRef.current = 0;
    startTimeRef.current = Date.now();

    await startListeningRef.current();

    setState('playing');
    dlog.info(TAG, `State → playing (Gemini coaching: ${GEMINI_API_KEY ? 'enabled' : 'fallback only'})`);
  }, [currentBarIndex, totalBars]);

  const finishBar = useCallback(() => {
    const duration = Date.now() - startTimeRef.current;
    const count = feedbackCountRef.current || 1;

    const result: BarResult = {
      barIndex: currentBarIndex,
      metrics: {
        pitchAccuracy: metricsAccRef.current.pitch / count,
        timing: metricsAccRef.current.timing / count,
        fingerPosition: metricsAccRef.current.fingers / count,
      },
      coachingNotes: [...coachingNotesRef.current],
      durationMs: duration,
    };

    dlog.info(TAG, `finishBar() – bar ${currentBarIndex + 1}, ${count} samples, ${duration}ms`);
    addBarResult(result);
    stopListeningRef.current();
    setState('saving');
  }, [currentBarIndex, addBarResult]);

  const nextBar = useCallback(() => {
    if (currentBarIndex >= totalBars - 1) {
      dlog.info(TAG, 'All bars complete → done');
      setState('done');
      return;
    }
    dlog.info(TAG, `nextBar() – advancing to bar ${currentBarIndex + 2}`);
    advanceBar();
    setState('idle');
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
  }, [currentBarIndex, totalBars, advanceBar]);

  const retryBar = useCallback(() => {
    dlog.info(TAG, `retryBar() – bar ${currentBarIndex + 1}`);
    stopListeningRef.current();
    setState('idle');
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
  }, [currentBarIndex]);

  const goToBar = useCallback(
    (index: number) => {
      dlog.info(TAG, `goToBar(${index})`);
      stopListeningRef.current();
      setCurrentBarIndex(index);
      setState('idle');
      setLiveMetrics(EMPTY_METRICS);
      setLatestFeedback(null);
    },
    [setCurrentBarIndex],
  );

  useEffect(() => {
    return () => { stopListeningRef.current(); };
  }, []);

  return {
    state,
    liveMetrics,
    latestFeedback,
    error,
    currentBarIndex,
    totalBars,
    currentBarNotes,
    currentSection,
    currentChords,
    startBar,
    finishBar,
    nextBar,
    retryBar,
    goToBar,
  };
}
