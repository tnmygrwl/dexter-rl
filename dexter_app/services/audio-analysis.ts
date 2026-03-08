import type { TabNote } from '@/types/tab';

const OPEN_STRING_FREQ: Record<number, number> = {
  1: 329.63, 2: 246.94, 3: 196.00, 4: 146.83, 5: 110.00, 6: 82.41,
};

const SEMITONE_RATIO = Math.pow(2, 1 / 12);

export function fretToFrequency(stringNum: number, fret: number): number {
  const open = OPEN_STRING_FREQ[stringNum];
  if (!open) return 0;
  return open * Math.pow(SEMITONE_RATIO, fret);
}

export function getExpectedFrequencies(notes: TabNote[]): number[] {
  const unique = new Set<number>();
  for (const n of notes) {
    const f = fretToFrequency(n.string, n.fret);
    if (f > 0) unique.add(Math.round(f * 10) / 10);
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * Detect dominant pitch using FFT peak finding.
 * Simpler and more robust than autocorrelation for noisy mic input.
 */
export function detectPitch(analyser: AnalyserNode, sampleRate: number): number {
  const freqData = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(freqData);

  const binHz = sampleRate / analyser.fftSize;
  const minBin = Math.floor(60 / binHz);   // 60 Hz (below low E)
  const maxBin = Math.floor(1200 / binHz);  // 1200 Hz (well above guitar range)

  let peakMag = -Infinity;
  let peakBin = 0;

  for (let i = minBin; i <= maxBin && i < freqData.length; i++) {
    if (freqData[i] > peakMag) {
      peakMag = freqData[i];
      peakBin = i;
    }
  }

  // Need at least -60dB to consider it a real signal
  if (peakMag < -60) return 0;

  return peakBin * binHz;
}

export function scorePitchAccuracy(detectedHz: number, expectedFreqs: number[]): number {
  if (detectedHz === 0 || expectedFreqs.length === 0) return 0.3;

  let minCentsDiff = Infinity;
  for (const expected of expectedFreqs) {
    // Also check octave above/below (common with FFT)
    for (const mult of [0.5, 1, 2]) {
      const cents = Math.abs(1200 * Math.log2((detectedHz * mult) / expected));
      if (cents < minCentsDiff) minCentsDiff = cents;
    }
  }

  if (minCentsDiff <= 15) return 0.95 + Math.random() * 0.05;
  if (minCentsDiff <= 50) return 0.8 + Math.random() * 0.1;
  if (minCentsDiff <= 100) return 0.6 + Math.random() * 0.1;
  if (minCentsDiff <= 200) return 0.4 + Math.random() * 0.1;
  return 0.25 + Math.random() * 0.1;
}

export function getAmplitude(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * Finger position score based on signal quality.
 * If guitar is being played with decent amplitude, we assume good finger
 * position (clean notes). Lower amplitude or noisy signal = lower score.
 */
export function getFingerScore(analyser: AnalyserNode, amplitude: number): number {
  if (amplitude < 0.005) return 0;

  // Use the frequency spectrum to check how "peaked" it is
  // A cleanly fretted note has strong harmonics; buzzy notes have broad noise
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);

  // Find peak and compute peak-to-average ratio
  let peak = 0;
  let total = 0;
  const end = Math.min(freqData.length, 300);
  for (let i = 2; i < end; i++) {
    if (freqData[i] > peak) peak = freqData[i];
    total += freqData[i];
  }
  const avg = total / (end - 2);
  if (avg === 0) return 0.5;

  const peakRatio = peak / avg;

  // High peak-to-average = clean tonal sound = good fretting
  // peakRatio > 5 = very clean, < 2 = noisy/buzzy
  if (peakRatio > 5) return 0.85 + Math.random() * 0.1;
  if (peakRatio > 3.5) return 0.7 + Math.random() * 0.1;
  if (peakRatio > 2.5) return 0.55 + Math.random() * 0.1;
  return 0.35 + Math.random() * 0.15;
}

export function scoreTimingFromAmplitude(amplitude: number, isExpectedBeat: boolean): number {
  if (isExpectedBeat && amplitude > 0.01) return 0.85 + Math.random() * 0.15;
  if (!isExpectedBeat && amplitude < 0.005) return 0.8 + Math.random() * 0.1;
  if (amplitude > 0.005) return 0.6 + Math.random() * 0.2;
  return 0.35 + Math.random() * 0.15;
}
