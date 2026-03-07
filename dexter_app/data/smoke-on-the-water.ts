import type { TabData } from '@/types/tab';

/**
 * Hardcoded tab data for "Smoke on the Water" by Deep Purple.
 * 8 bars covering the iconic intro riff + first verse bars.
 * The riff is played on strings 3 (G) and 4 (D) — frets 0, 3, 5, 6.
 */
export const SMOKE_ON_THE_WATER: TabData = {
  metadata: {
    title: 'Smoke On The Water',
    artist: 'Deep Purple',
    key: 'G minor',
    tempo: 116,
    timeSignature: [4, 4],
    tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
    capo: 0,
    difficulty: 'beginner',
  },
  sections: [
    { name: 'Intro Riff', startBar: 1, endBar: 4, chords: ['G5', 'Bb5', 'C5'] },
    { name: 'Intro Riff (repeat)', startBar: 5, endBar: 8, chords: ['G5', 'Bb5', 'Db5', 'C5'] },
  ],
  notes: [
    // Bar 1: G5 - Bb5 - C5 (first phrase of the riff)
    // G5 power chord on strings 3-4
    { bar: 1, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 1, beat: 1, string: 3, fret: 0, duration: 1 },
    // Bb5
    { bar: 1, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 1, beat: 2.5, string: 3, fret: 3, duration: 1 },
    // C5
    { bar: 1, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 1, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 2: G5 - Bb5 - Db5 - C5
    { bar: 2, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 2, beat: 1, string: 3, fret: 0, duration: 1 },
    { bar: 2, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 2, beat: 2.5, string: 3, fret: 3, duration: 1 },
    { bar: 2, beat: 3.5, string: 4, fret: 6, duration: 0.5 },
    { bar: 2, beat: 3.5, string: 3, fret: 6, duration: 0.5 },
    { bar: 2, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 2, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 3: same as bar 1
    { bar: 3, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 3, beat: 1, string: 3, fret: 0, duration: 1 },
    { bar: 3, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 3, beat: 2.5, string: 3, fret: 3, duration: 1 },
    { bar: 3, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 3, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 4: Bb5 resolving down to G5 (hold)
    { bar: 4, beat: 1, string: 4, fret: 3, duration: 1 },
    { bar: 4, beat: 1, string: 3, fret: 3, duration: 1 },
    { bar: 4, beat: 3, string: 4, fret: 0, duration: 2 },
    { bar: 4, beat: 3, string: 3, fret: 0, duration: 2 },

    // Bar 5: repeat — G5 - Bb5 - C5
    { bar: 5, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 5, beat: 1, string: 3, fret: 0, duration: 1 },
    { bar: 5, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 5, beat: 2.5, string: 3, fret: 3, duration: 1 },
    { bar: 5, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 5, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 6: G5 - Bb5 - Db5 - C5
    { bar: 6, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 6, beat: 1, string: 3, fret: 0, duration: 1 },
    { bar: 6, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 6, beat: 2.5, string: 3, fret: 3, duration: 1 },
    { bar: 6, beat: 3.5, string: 4, fret: 6, duration: 0.5 },
    { bar: 6, beat: 3.5, string: 3, fret: 6, duration: 0.5 },
    { bar: 6, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 6, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 7: same as bar 3
    { bar: 7, beat: 1, string: 4, fret: 0, duration: 1 },
    { bar: 7, beat: 1, string: 3, fret: 0, duration: 1 },
    { bar: 7, beat: 2.5, string: 4, fret: 3, duration: 1 },
    { bar: 7, beat: 2.5, string: 3, fret: 3, duration: 1 },
    { bar: 7, beat: 4, string: 4, fret: 5, duration: 1 },
    { bar: 7, beat: 4, string: 3, fret: 5, duration: 1 },

    // Bar 8: Bb5 resolving to G5 (final hold)
    { bar: 8, beat: 1, string: 4, fret: 3, duration: 1 },
    { bar: 8, beat: 1, string: 3, fret: 3, duration: 1 },
    { bar: 8, beat: 3, string: 4, fret: 0, duration: 2 },
    { bar: 8, beat: 3, string: 3, fret: 0, duration: 2 },
  ],
};
