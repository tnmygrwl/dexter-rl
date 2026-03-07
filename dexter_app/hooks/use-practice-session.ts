import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/context/session-context';
import { LIVEKIT_URL } from '@/config';
import { LiveKitSession } from '@/services/livekit';
import { fetchLiveKitToken } from '@/services/livekit-token';
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

const DEMO_COACHING = [
  'Good fretting on the G string — keep your index finger close to the fret wire.',
  'Timing slightly ahead of the beat. Try to relax into the groove.',
  'Nice power chord shape! Make sure your pinky stays curled.',
  'Watch the transition from fret 3 to fret 5 — slide rather than lifting.',
  'Your pick attack is solid. Try a lighter touch for the muted notes.',
  'Great job holding the rhythm steady through this phrase.',
  'The Bb5 chord sounds a bit buzzy — press harder on string 4.',
  'Smooth transition! Your hand position is looking much better.',
];

function randomWalk(current: number, min = 0.45, max = 0.95): number {
  const drift = (Math.random() - 0.4) * 0.15;
  return Math.max(min, Math.min(max, current + drift));
}

export function usePracticeSession() {
  const { tabData, currentBarIndex, totalBars, addBarResult, advanceBar, setCurrentBarIndex } =
    useSession();
  const [state, setState] = useState<PracticeState>('idle');
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>(EMPTY_METRICS);
  const [latestFeedback, setLatestFeedback] = useState<GeminiFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<LiveKitSession | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackCountRef = useRef(0);
  const metricsAccRef = useRef({ pitch: 0, timing: 0, fingers: 0 });
  const startTimeRef = useRef(0);
  const coachingNotesRef = useRef<string[]>([]);
  const demoMetricsRef = useRef({ pitch: 0.7, timing: 0.65, fingers: 0.72 });

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

  const buildBarContext = useCallback(() => {
    if (!tabData) return '';
    const barNum = currentBarIndex + 1;
    const lines = [
      `Now playing: Bar ${barNum} of ${totalBars}`,
      `Song: ${tabData.metadata.title} by ${tabData.metadata.artist}`,
      `Key: ${tabData.metadata.key}, Tempo: ${tabData.metadata.tempo} BPM`,
      `Time Signature: ${tabData.metadata.timeSignature.join('/')}`,
    ];
    if (currentSection) lines.push(`Section: ${currentSection.name}`);
    if (currentChords.length > 0) lines.push(`Expected chords: ${currentChords.join(' → ')}`);
    if (currentBarNotes.length > 0) {
      const noteDesc = currentBarNotes
        .slice(0, 12)
        .map((n) => `string${n.string} fret${n.fret}`)
        .join(', ');
      lines.push(`Expected notes: ${noteDesc}`);
    }
    return lines.join('\n');
  }, [tabData, currentBarIndex, totalBars, currentSection, currentChords, currentBarNotes]);

  const handleFeedback = useCallback((fb: GeminiFeedback) => {
    feedbackCountRef.current++;
    metricsAccRef.current.pitch += fb.pitchAccuracy;
    metricsAccRef.current.timing += fb.timing;
    metricsAccRef.current.fingers += fb.fingerPosition;

    const count = feedbackCountRef.current;
    setLiveMetrics({
      pitchAccuracy: metricsAccRef.current.pitch / count,
      timing: metricsAccRef.current.timing / count,
      fingerPosition: metricsAccRef.current.fingers / count,
    });

    setLatestFeedback(fb);

    if (fb.feedback && fb.feedback.trim().length > 0) {
      coachingNotesRef.current.push(fb.feedback);
    }
    dlog.info(TAG, `Feedback #${count}: pitch=${fb.pitchAccuracy.toFixed(2)} timing=${fb.timing.toFixed(2)}`);
  }, []);

  // --- Demo simulation ---
  const stopDemoSimulation = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
  }, []);

  const startDemoSimulation = useCallback(() => {
    dlog.info(TAG, 'Starting demo simulation (no LiveKit)');
    demoMetricsRef.current = {
      pitch: 0.55 + Math.random() * 0.2,
      timing: 0.5 + Math.random() * 0.2,
      fingers: 0.6 + Math.random() * 0.15,
    };
    let tick = 0;

    demoIntervalRef.current = setInterval(() => {
      const dm = demoMetricsRef.current;
      dm.pitch = randomWalk(dm.pitch);
      dm.timing = randomWalk(dm.timing);
      dm.fingers = randomWalk(dm.fingers);

      const coachingMsg = tick % 3 === 0
        ? DEMO_COACHING[tick % DEMO_COACHING.length]
        : '';

      const expectedChord = currentChords[tick % Math.max(currentChords.length, 1)] ?? 'G5';

      handleFeedback({
        pitchAccuracy: dm.pitch,
        timing: dm.timing,
        fingerPosition: dm.fingers,
        detectedChord: expectedChord,
        expectedChord,
        feedback: coachingMsg,
      });

      tick++;
    }, 1500);
  }, [handleFeedback, currentChords]);

  // --- Start bar ---
  const startBar = useCallback(async () => {
    dlog.info(TAG, `startBar() – bar ${currentBarIndex + 1} of ${totalBars}`);
    setError(null);
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
    feedbackCountRef.current = 0;
    metricsAccRef.current = { pitch: 0, timing: 0, fingers: 0 };
    coachingNotesRef.current = [];
    startTimeRef.current = Date.now();

    // Always start demo simulation for live metric animation.
    // If a real agent sends feedback via LiveKit, those override the demo values.
    startDemoSimulation();

    if (LIVEKIT_URL) {
      setState('connecting');
      const barCtx = buildBarContext();
      try {
        dlog.info(TAG, 'Fetching LiveKit token...');
        const { token } = await fetchLiveKitToken('dexter-practice', 'student');

        const lkSession = new LiveKitSession();
        sessionRef.current = lkSession;
        lkSession.onFeedback(handleFeedback);

        dlog.info(TAG, 'Connecting to LiveKit room...');
        await lkSession.connect(token, barCtx);
        dlog.info(TAG, 'Connected! Camera + audio publishing.');
      } catch (err) {
        dlog.warn(TAG, `LiveKit connect failed (demo sim still running): ${err}`);
      }
    }

    setState('playing');
    dlog.info(TAG, 'State → playing');
  }, [buildBarContext, handleFeedback, startDemoSimulation, currentBarIndex, totalBars]);

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

    dlog.info(TAG, `finishBar() – bar ${currentBarIndex + 1}, ${count} feedbacks, ${duration}ms`);
    addBarResult(result);
    stopDemoSimulation();
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setState('saving');
  }, [currentBarIndex, addBarResult, stopDemoSimulation]);

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
    stopDemoSimulation();
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setState('idle');
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
  }, [currentBarIndex, stopDemoSimulation]);

  const goToBar = useCallback(
    (index: number) => {
      dlog.info(TAG, `goToBar(${index})`);
      stopDemoSimulation();
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setCurrentBarIndex(index);
      setState('idle');
      setLiveMetrics(EMPTY_METRICS);
      setLatestFeedback(null);
    },
    [setCurrentBarIndex, stopDemoSimulation],
  );

  useEffect(() => {
    return () => {
      stopDemoSimulation();
      sessionRef.current?.disconnect();
    };
  }, [stopDemoSimulation]);

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
