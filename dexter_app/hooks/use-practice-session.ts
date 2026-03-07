import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/context/session-context';
import { GeminiLiveClient } from '@/services/gemini-live';
import { dlog } from '@/utils/debug-log';
import type { BarResult, GeminiFeedback, TabNote } from '@/types/tab';

const TAG = 'Practice';

export type PracticeState = 'idle' | 'playing' | 'saving' | 'done';

export interface LiveMetrics {
  pitchAccuracy: number;
  timing: number;
  fingerPosition: number;
}

const EMPTY_METRICS: LiveMetrics = { pitchAccuracy: 0, timing: 0, fingerPosition: 0 };

export function usePracticeSession() {
  const { tabData, currentBarIndex, totalBars, addBarResult, advanceBar, setCurrentBarIndex } =
    useSession();
  const [state, setState] = useState<PracticeState>('idle');
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>(EMPTY_METRICS);
  const [latestFeedback, setLatestFeedback] = useState<GeminiFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const feedbackCountRef = useRef(0);
  const metricsAccRef = useRef({ pitch: 0, timing: 0, fingers: 0 });
  const startTimeRef = useRef(0);
  const coachingNotesRef = useRef<string[]>([]);

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
    if (currentSection) {
      lines.push(`Section: ${currentSection.name}`);
    }
    if (currentChords.length > 0) {
      lines.push(`Expected chords: ${currentChords.join(' → ')}`);
    }
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
    dlog.info(TAG, `Feedback #${count}: "${fb.feedback?.slice(0, 60)}"`);
  }, []);

  const startBar = useCallback(async () => {
    dlog.info(TAG, `startBar() – bar ${currentBarIndex + 1} of ${totalBars}`);
    setError(null);
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
    feedbackCountRef.current = 0;
    metricsAccRef.current = { pitch: 0, timing: 0, fingers: 0 };
    coachingNotesRef.current = [];
    startTimeRef.current = Date.now();

    const barCtx = buildBarContext();
    dlog.info(TAG, `Bar context:\n${barCtx}`);

    try {
      const client = new GeminiLiveClient();
      clientRef.current = client;
      client.onFeedback(handleFeedback);

      dlog.info(TAG, 'Connecting to Gemini Live...');
      await client.connect(barCtx);
      dlog.info(TAG, 'Connected! Sending initial bar context...');

      client.sendBarContext(barCtx);
      setState('playing');
      dlog.info(TAG, 'State → playing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      dlog.error(TAG, `startBar failed: ${msg}`);
      setError(msg);
      setState('idle');
    }
  }, [buildBarContext, handleFeedback, currentBarIndex, totalBars]);

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
    clientRef.current?.disconnect();
    clientRef.current = null;
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

  const retryBar = useCallback(async () => {
    dlog.info(TAG, `retryBar() – bar ${currentBarIndex + 1}`);
    clientRef.current?.disconnect();
    clientRef.current = null;
    setState('idle');
    setLiveMetrics(EMPTY_METRICS);
    setLatestFeedback(null);
  }, [currentBarIndex]);

  const goToBar = useCallback(
    (index: number) => {
      dlog.info(TAG, `goToBar(${index})`);
      clientRef.current?.disconnect();
      clientRef.current = null;
      setCurrentBarIndex(index);
      setState('idle');
      setLiveMetrics(EMPTY_METRICS);
      setLatestFeedback(null);
    },
    [setCurrentBarIndex],
  );

  const sendFrame = useCallback((base64: string) => {
    clientRef.current?.sendFrame(base64);
  }, []);

  const sendAudio = useCallback((base64: string) => {
    clientRef.current?.sendAudio(base64);
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
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
    sendFrame,
    sendAudio,
  };
}
