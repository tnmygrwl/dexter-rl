import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/context/session-context';
import { GEMINI_API_KEY } from '@/config';
import { getCoachingFeedback } from '@/services/gemini-coach';
import { useAudioAnalysis, type AudioMetrics } from '@/hooks/use-audio-analysis';
import { dlog } from '@/utils/debug-log';
import type { BarResult, TabNote } from '@/types/tab';

const TAG = 'Practice';

export type PracticeState = 'idle' | 'connecting' | 'playing' | 'saving' | 'done';

const FALLBACK_TIPS = [
  'Focus on the power chord shape — index and ring finger on the same fret distance.',
  'For Smoke on the Water, keep your hand relaxed on strings 3 and 4. Let the open G and D ring.',
  'The riff moves 0-3-5 on the D string. Try playing each position slowly before connecting them.',
  'Watch the Bb5 to C5 transition — it\'s just a two-fret slide on both strings.',
  'The key to this riff is even spacing between the power chords. Don\'t rush the gaps.',
  'Try muting with your palm between the chords for that classic rock feel.',
  'Bar 2 has the Db5 (fret 6) as a quick passing chord — just a brief touch before resolving to C5.',
  'Great practice session! Repetition builds muscle memory. Keep at it.',
];

export function usePracticeSession() {
  const { tabData, currentBarIndex, totalBars, addBarResult, advanceBar, setCurrentBarIndex } =
    useSession();
  const [state, setState] = useState<PracticeState>('idle');
  const [coachingMessages, setCoachingMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const feedbackCountRef = useRef(0);
  const metricsAccRef = useRef({ pitch: 0, timing: 0, fingers: 0 });
  const startTimeRef = useRef(0);
  const coachingTickRef = useRef(0);
  const metricsTickRef = useRef(0);
  const lastAudioRef = useRef<AudioMetrics | null>(null);
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

  const addCoachingMessage = useCallback((msg: string) => {
    setCoachingMessages((prev) => [...prev, msg]);
  }, []);

  const requestGeminiCoaching = useCallback(async () => {
    if (!GEMINI_API_KEY || !tabData || coachingInFlightRef.current) return;
    coachingInFlightRef.current = true;

    const am = lastAudioRef.current;
    const noteDesc = currentBarNotes
      .slice(0, 8)
      .map((n) => `string${n.string} fret${n.fret}`)
      .join(', ');

    try {
      const tip = await getCoachingFeedback({
        songTitle: tabData.metadata.title,
        artist: tabData.metadata.artist,
        key: tabData.metadata.key,
        tempo: tabData.metadata.tempo,
        barNumber: currentBarIndex + 1,
        totalBars,
        sectionName: currentSection?.name ?? 'Unknown',
        expectedChords: currentChords,
        expectedNotes: noteDesc || 'none specified',
        detectedHz: am?.detectedHz ?? 0,
        amplitude: am?.amplitude ?? 0,
        isPlaying: am?.isPlaying ?? false,
        elapsedSeconds: (Date.now() - startTimeRef.current) / 1000,
      });
      if (tip) addCoachingMessage(tip);
    } catch {
      // Fallback on error
      const tip = FALLBACK_TIPS[fallbackIdxRef.current % FALLBACK_TIPS.length];
      fallbackIdxRef.current++;
      addCoachingMessage(tip);
    }
    coachingInFlightRef.current = false;
  }, [tabData, currentBarIndex, totalBars, currentSection, currentChords, currentBarNotes, addCoachingMessage]);

  const handleAudioMetrics = useCallback((am: AudioMetrics) => {
    metricsTickRef.current++;
    lastAudioRef.current = am;

    if (am.isPlaying) {
      feedbackCountRef.current++;
      metricsAccRef.current.pitch += am.pitchAccuracy;
      metricsAccRef.current.timing += am.timing;
      metricsAccRef.current.fingers += am.fingerPosition;
    }

    // Request coaching every ~5 seconds (100 ticks at 50ms)
    coachingTickRef.current++;
    if (coachingTickRef.current % 100 === 0) {
      if (GEMINI_API_KEY && !coachingInFlightRef.current) {
        requestGeminiCoaching();
      } else if (!GEMINI_API_KEY) {
        const tip = FALLBACK_TIPS[fallbackIdxRef.current % FALLBACK_TIPS.length];
        fallbackIdxRef.current++;
        addCoachingMessage(tip);
      }
    }

    if (metricsTickRef.current % 60 === 0) {
      dlog.info(TAG, `Audio: amp=${am.amplitude.toFixed(4)} hz=${am.detectedHz.toFixed(0)} playing=${am.isPlaying}`);
    }
  }, [requestGeminiCoaching, addCoachingMessage]);

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
    setCoachingMessages([]);
    feedbackCountRef.current = 0;
    metricsAccRef.current = { pitch: 0, timing: 0, fingers: 0 };
    coachingTickRef.current = 0;
    metricsTickRef.current = 0;
    fallbackIdxRef.current = 0;
    lastAudioRef.current = null;
    startTimeRef.current = Date.now();

    await startListeningRef.current();

    setState('playing');
    dlog.info(TAG, `State → playing (Gemini: ${GEMINI_API_KEY ? 'on' : 'fallback'})`);

    // Immediately request first coaching message
    if (GEMINI_API_KEY) {
      requestGeminiCoaching();
    } else {
      addCoachingMessage(FALLBACK_TIPS[0]);
    }
  }, [currentBarIndex, totalBars, requestGeminiCoaching, addCoachingMessage]);

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
      coachingNotes: [...coachingMessages],
      durationMs: duration,
    };

    dlog.info(TAG, `finishBar() – bar ${currentBarIndex + 1}, ${duration}ms, ${coachingMessages.length} tips`);
    addBarResult(result);
    stopListeningRef.current();
    setState('saving');
  }, [currentBarIndex, addBarResult, coachingMessages]);

  const nextBar = useCallback(() => {
    if (currentBarIndex >= totalBars - 1) {
      setState('done');
      return;
    }
    advanceBar();
    setState('idle');
    setCoachingMessages([]);
  }, [currentBarIndex, totalBars, advanceBar]);

  const retryBar = useCallback(() => {
    stopListeningRef.current();
    setState('idle');
    setCoachingMessages([]);
  }, []);

  const goToBar = useCallback(
    (index: number) => {
      stopListeningRef.current();
      setCurrentBarIndex(index);
      setState('idle');
      setCoachingMessages([]);
    },
    [setCurrentBarIndex],
  );

  useEffect(() => {
    return () => { stopListeningRef.current(); };
  }, []);

  return {
    state,
    coachingMessages,
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
