import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/context/session-context';
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

const COACHING_MESSAGES: Record<string, string[]> = {
  pitch: [
    'Pitch is drifting — check your intonation on that fret.',
    'Notes sound a bit flat. Press closer to the fret wire.',
    'Sharp on that last note. Ease up on the bend.',
  ],
  timing: [
    'Rushing slightly — try to lock into the groove.',
    'Dragging behind the beat. Feel the pulse in your picking hand.',
    'Timing is uneven. Count in your head: 1-and-2-and-3-and-4.',
  ],
  fingers: [
    'Fret buzz detected — press harder on the string.',
    'Muted notes coming through. Check finger placement.',
    'Chord sounds muddy. Arch your fingers more to clear the strings.',
  ],
  good: [
    'Sounding great! Keep that energy.',
    'Clean notes, solid rhythm. Nice work.',
    'Great power chord tone. Keep it up!',
    'Smooth transition between chords.',
  ],
};

function pickCoaching(metrics: LiveMetrics): string {
  const worst = Math.min(metrics.pitchAccuracy, metrics.timing, metrics.fingerPosition);
  if (worst > 0.75) {
    return COACHING_MESSAGES.good[Math.floor(Math.random() * COACHING_MESSAGES.good.length)];
  }
  if (metrics.pitchAccuracy === worst) {
    return COACHING_MESSAGES.pitch[Math.floor(Math.random() * COACHING_MESSAGES.pitch.length)];
  }
  if (metrics.timing === worst) {
    return COACHING_MESSAGES.timing[Math.floor(Math.random() * COACHING_MESSAGES.timing.length)];
  }
  return COACHING_MESSAGES.fingers[Math.floor(Math.random() * COACHING_MESSAGES.fingers.length)];
}

// Exponential moving average for smooth bar updates
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

  // Audio analysis callback — updates metrics from real mic input
  const handleAudioMetrics = useCallback((am: AudioMetrics) => {
    if (!am.isPlaying) return; // Only update when there's actual sound

    const sm = smoothMetricsRef.current;
    sm.pitch = ema(sm.pitch, am.pitchAccuracy);
    sm.timing = ema(sm.timing, am.timing);
    sm.fingers = ema(sm.fingers, am.fingerPosition);

    feedbackCountRef.current++;
    metricsAccRef.current.pitch += am.pitchAccuracy;
    metricsAccRef.current.timing += am.timing;
    metricsAccRef.current.fingers += am.fingerPosition;

    setLiveMetrics({
      pitchAccuracy: sm.pitch,
      timing: sm.timing,
      fingerPosition: sm.fingers,
    });

    // Generate coaching feedback every ~3 seconds (60 ticks at 50ms)
    coachingTickRef.current++;
    if (coachingTickRef.current % 60 === 0) {
      const msg = pickCoaching({ pitchAccuracy: sm.pitch, timing: sm.timing, fingerPosition: sm.fingers });
      const expectedChord = currentChords[0] ?? null;
      const fb: GeminiFeedback = {
        pitchAccuracy: sm.pitch,
        timing: sm.timing,
        fingerPosition: sm.fingers,
        detectedChord: am.detectedHz > 0 ? `~${Math.round(am.detectedHz)}Hz` : null,
        expectedChord,
        feedback: msg,
      };
      setLatestFeedback(fb);
      coachingNotesRef.current.push(msg);
      dlog.info(TAG, `Coaching: "${msg}" (pitch=${sm.pitch.toFixed(2)} timing=${sm.timing.toFixed(2)} fingers=${sm.fingers.toFixed(2)})`);
    }
  }, [currentChords]);

  const audioAnalysis = useAudioAnalysis({
    expectedNotes: currentBarNotes,
    tempo,
    onMetrics: handleAudioMetrics,
  });

  const startBar = useCallback(async () => {
    dlog.info(TAG, `startBar() – bar ${currentBarIndex + 1} of ${totalBars}`);
    setError(null);
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
    feedbackCountRef.current = 0;
    metricsAccRef.current = { pitch: 0, timing: 0, fingers: 0 };
    smoothMetricsRef.current = { pitch: 0.5, timing: 0.5, fingers: 0.5 };
    coachingNotesRef.current = [];
    coachingTickRef.current = 0;
    startTimeRef.current = Date.now();

    // Start real mic audio analysis
    audioAnalysis.startListening();

    setState('playing');
    dlog.info(TAG, 'State → playing (audio analysis active)');
  }, [audioAnalysis, currentBarIndex, totalBars]);

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
    audioAnalysis.stopListening();
    setState('saving');
  }, [currentBarIndex, addBarResult, audioAnalysis]);

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
    audioAnalysis.stopListening();
    setState('idle');
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
  }, [currentBarIndex, audioAnalysis]);

  const goToBar = useCallback(
    (index: number) => {
      dlog.info(TAG, `goToBar(${index})`);
      audioAnalysis.stopListening();
      setCurrentBarIndex(index);
      setState('idle');
      setLiveMetrics(EMPTY_METRICS);
      setLatestFeedback(null);
    },
    [setCurrentBarIndex, audioAnalysis],
  );

  useEffect(() => {
    return () => {
      audioAnalysis.stopListening();
    };
  }, [audioAnalysis]);

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
