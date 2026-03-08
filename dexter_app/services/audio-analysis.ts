import { dlog } from '@/utils/debug-log';
import type { TabNote } from '@/types/tab';

const TAG = 'AudioAnalysis';

// Standard tuning open string frequencies (Hz)
const OPEN_STRING_FREQ: Record<number, number> = {
  1: 329.63,  // high E4
  2: 246.94,  // B3
  3: 196.00,  // G3
  4: 146.83,  // D3
  5: 110.00,  // A2
  6: 82.41,   // low E2
};

const SEMITONE_RATIO = Math.pow(2, 1 / 12);

/** Convert a (string, fret) pair to its expected frequency in Hz. */
export function fretToFrequency(stringNum: number, fret: number): number {
  const open = OPEN_STRING_FREQ[stringNum];
  if (!open) return 0;
  return open * Math.pow(SEMITONE_RATIO, fret);
}

/** Get all expected frequencies for a set of notes. */
export function getExpectedFrequencies(notes: TabNote[]): number[] {
  const unique = new Set<number>();
  for (const n of notes) {
    const f = fretToFrequency(n.string, n.fret);
    if (f > 0) unique.add(Math.round(f * 10) / 10);
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * Detect the dominant pitch from an FFT frequency buffer using autocorrelation.
 * Returns frequency in Hz, or 0 if no clear pitch detected.
 */
export function detectPitch(
  analyser: AnalyserNode,
  sampleRate: number,
): number {
  const bufLen = analyser.fftSize;
  const buf = new Float32Array(bufLen);
  analyser.getFloatTimeDomainData(buf);

  // Check if there's enough signal (RMS > threshold)
  let rms = 0;
  for (let i = 0; i < bufLen; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / bufLen);
  if (rms < 0.01) return 0;

  // Autocorrelation pitch detection
  const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
  const maxPeriod = Math.floor(sampleRate / 60);    // 60 Hz min (below low E)

  let bestCorrelation = 0;
  let bestPeriod = 0;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    for (let i = 0; i < bufLen - period; i++) {
      correlation += buf[i] * buf[i + period];
    }
    correlation /= (bufLen - period);

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  if (bestCorrelation < 0.01 || bestPeriod === 0) return 0;

  return sampleRate / bestPeriod;
}

/**
 * Score how close a detected frequency is to any of the expected frequencies.
 * Returns 0-1 (1 = perfect match).
 */
export function scorePitchAccuracy(
  detectedHz: number,
  expectedFreqs: number[],
): number {
  if (detectedHz === 0 || expectedFreqs.length === 0) return 0;

  let minCentsDiff = Infinity;
  for (const expected of expectedFreqs) {
    const cents = Math.abs(1200 * Math.log2(detectedHz / expected));
    if (cents < minCentsDiff) minCentsDiff = cents;
  }

  // 0 cents = perfect, 50 cents = half semitone, 100+ cents = wrong note
  if (minCentsDiff <= 10) return 1.0;
  if (minCentsDiff >= 200) return 0.1;
  return Math.max(0.1, 1.0 - (minCentsDiff / 200) * 0.9);
}

/**
 * Compute RMS amplitude from the analyser (0-1 range).
 * Used for onset detection and "is the player playing?" checks.
 */
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
 * Compute spectral flatness (0 = tonal/clean, 1 = noise/buzzy).
 * Lower flatness = cleaner playing = better finger position.
 */
export function getSpectralClarity(analyser: AnalyserNode): number {
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);

  let geoSum = 0;
  let arithSum = 0;
  let count = 0;

  // Focus on guitar range (roughly bins 2-200 depending on FFT size)
  const start = 2;
  const end = Math.min(freqData.length, 200);

  for (let i = start; i < end; i++) {
    const val = Math.max(freqData[i], 1); // avoid log(0)
    geoSum += Math.log(val);
    arithSum += val;
    count++;
  }

  if (count === 0 || arithSum === 0) return 0.5;

  const geoMean = Math.exp(geoSum / count);
  const arithMean = arithSum / count;
  const flatness = geoMean / arithMean; // 0 (tonal) to 1 (noise)

  // Invert: high clarity = good finger position
  return Math.max(0.1, Math.min(1.0, 1.0 - flatness));
}

/**
 * Score timing based on whether amplitude spikes align with expected beats.
 * Uses a simplified approach: checks if playing is happening at all
 * and gives higher scores for consistent amplitude.
 */
export function scoreTimingFromAmplitude(
  amplitude: number,
  isExpectedBeat: boolean,
): number {
  if (isExpectedBeat && amplitude > 0.05) return 0.9 + Math.random() * 0.1;
  if (!isExpectedBeat && amplitude < 0.02) return 0.85 + Math.random() * 0.1;
  if (amplitude > 0.02) return 0.6 + Math.random() * 0.2;
  return 0.3 + Math.random() * 0.2;
}
