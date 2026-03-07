import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL, USE_MOCK_DATA } from '@/config';
import type { TabData } from '@/types/tab';

const TAB_SCHEMA_DESCRIPTION = `Return ONLY valid JSON matching this exact schema (no markdown fences, no explanation):

{
  "metadata": {
    "title": "string",
    "artist": "string",
    "key": "string (e.g. 'G major', 'E minor')",
    "tempo": number (BPM),
    "timeSignature": [numerator, denominator],
    "tuning": ["E", "A", "D", "G", "B", "E"],
    "capo": number (0 if none),
    "difficulty": "beginner" | "intermediate" | "advanced"
  },
  "sections": [
    {
      "name": "string (e.g. 'Intro', 'Verse 1', 'Chorus')",
      "startBar": number,
      "endBar": number,
      "chords": ["Am", "F", "C", "G"]
    }
  ],
  "notes": [
    {
      "bar": number,
      "beat": number (1-indexed within bar),
      "string": number (1=high E, 6=low E),
      "fret": number,
      "duration": number (in beats),
      "technique": null | "hammer-on" | "pull-off" | "slide" | "bend" | "vibrato"
    }
  ]
}`;

const GENERATE_PROMPT = `You are a music theory expert and professional guitar transcriber. Given information about a song from a tab database, generate accurate and complete structured guitar tab data in JSON format.

${TAB_SCHEMA_DESCRIPTION}

Use your knowledge of this song to generate:
- Accurate chord progressions for each section
- Correct key, tempo, and time signature
- Realistic note-by-note tab data for the main guitar part (at minimum the first 8-16 bars covering intro + first verse)
- Correct tuning and capo position
- Proper section boundaries

Be musically accurate. For well-known songs, use the standard published chord progressions and arrangements.`;

const PARSE_PROMPT = `You are a music theory expert and guitar tab parser. Given the raw text of a guitar tab, extract structured data in JSON format.

${TAB_SCHEMA_DESCRIPTION}

Parse the tab notation carefully:
- Each group of 6 horizontal lines is one tab staff (strings high E to low E, top to bottom)
- Numbers on lines are fret positions
- 'h' = hammer-on, 'p' = pull-off, '/' or '\\' = slide, 'b' = bend, '~' = vibrato
- Bar lines are '|' characters
- Estimate beat positions based on spacing between notes

If information is missing (like tempo), make a reasonable estimate based on the song.`;

function getGenAI() {
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

function parseGeminiJson(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini did not return valid JSON');
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generates structured tab data using Gemini's knowledge of the song,
 * given metadata from the Songsterr API.
 */
export async function generateTabWithGemini(songContext: string): Promise<TabData> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is required for live tab generation');
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent([
    GENERATE_PROMPT,
    `\nSong information from tab database:\n${songContext}`,
  ]);
  const text = result.response.text();
  const parsed = parseGeminiJson(text);

  return {
    metadata: parsed.metadata as TabData['metadata'],
    sections: parsed.sections as TabData['sections'],
    notes: parsed.notes as TabData['notes'],
  };
}

/**
 * Parses raw tab text (from scraping or mock data) into structured TabData.
 * Uses Gemini when available, falls back to local parsing.
 */
export async function parseTabWithGemini(rawTabText: string): Promise<TabData> {
  if (USE_MOCK_DATA || !GEMINI_API_KEY) {
    return parseTabLocally(rawTabText);
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent([PARSE_PROMPT, rawTabText]);
  const text = result.response.text();
  const parsed = parseGeminiJson(text);

  return {
    metadata: parsed.metadata as TabData['metadata'],
    sections: parsed.sections as TabData['sections'],
    notes: parsed.notes as TabData['notes'],
    rawText: rawTabText,
  };
}

/**
 * Local fallback parser that extracts what it can without Gemini.
 * Handles the structured mock data format where metadata is embedded in the text.
 */
function parseTabLocally(rawText: string): TabData {
  const lines = rawText.split('\n');

  let title = '';
  let artist = '';
  let key = '';
  let tempo = 120;
  let timeSignature: [number, number] = [4, 4];
  let tuning = ['E', 'A', 'D', 'G', 'B', 'E'];
  let capo = 0;

  const sections: TabData['sections'] = [];
  const notes: TabData['notes'] = [];
  let currentSection = '';
  let barCount = 0;
  let sectionStartBar = 1;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.match(/^.+\s*-\s*.+$/) && !title) {
      const parts = trimmed.split(/\s*-\s*/);
      if (parts.length >= 2) {
        title = parts[0].trim();
        artist = parts[1].trim();
      }
    }

    const keyMatch = trimmed.match(/Key:\s*(.+)/i);
    if (keyMatch) key = keyMatch[1].trim();

    const tempoMatch = trimmed.match(/Tempo:\s*(\d+)/i);
    if (tempoMatch) tempo = parseInt(tempoMatch[1], 10);

    const timeMatch = trimmed.match(/Time Signature:\s*(\d+)\/(\d+)/i);
    if (timeMatch) timeSignature = [parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10)];

    const capoMatch = trimmed.match(/Capo\s*(\d+)/i);
    if (capoMatch) capo = parseInt(capoMatch[1], 10);

    const tuningMatch = trimmed.match(/Tuning:\s*([\w\s#b]+)/i);
    if (tuningMatch) {
      const t = tuningMatch[1].trim().split(/\s+/).filter((s) => s.length <= 2);
      if (t.length === 6) tuning = t;
    }

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      if (currentSection && barCount > 0) {
        sections.push({
          name: currentSection,
          startBar: sectionStartBar,
          endBar: barCount,
          chords: extractChordsFromSection(lines, sections.length),
        });
      }
      currentSection = sectionMatch[1];
      sectionStartBar = barCount + 1;
    }

    if (trimmed.match(/^e\|/i)) {
      const barMatches = trimmed.match(/\|/g);
      if (barMatches) barCount += Math.max(0, barMatches.length - 1);
    }

    const tabMatch = trimmed.match(/^([eEbBgGdDaA])\|(.+)/);
    if (tabMatch) {
      const stringName = tabMatch[1].toUpperCase();
      const stringNum = { E: 1, B: 2, G: 3, D: 4, A: 5 }[stringName] ?? 6;
      const content = tabMatch[2];
      let beat = 1;
      for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch >= '0' && ch <= '9') {
          let fretStr = ch;
          if (i + 1 < content.length && content[i + 1] >= '0' && content[i + 1] <= '9') {
            fretStr += content[i + 1];
            i++;
          }
          notes.push({
            bar: Math.max(1, Math.ceil(beat / timeSignature[0])),
            beat: ((beat - 1) % timeSignature[0]) + 1,
            string: stringNum,
            fret: parseInt(fretStr, 10),
            duration: 1,
          });
          beat++;
        } else if (ch === '|') {
          beat = 1;
        }
      }
    }
  }

  if (currentSection) {
    sections.push({
      name: currentSection,
      startBar: sectionStartBar,
      endBar: Math.max(barCount, sectionStartBar),
      chords: extractChordsFromSection(lines, sections.length),
    });
  }

  return {
    metadata: {
      title: title || 'Unknown',
      artist: artist || 'Unknown',
      key: key || 'Unknown',
      tempo,
      timeSignature,
      tuning,
      capo,
      difficulty: estimateDifficulty(notes),
    },
    sections,
    notes,
    rawText,
  };
}

function extractChordsFromSection(lines: string[], _sectionIndex: number): string[] {
  const chordPattern = /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus[24]?|add\d|7|9|11|13|M7|m7)?(?:\/[A-G][#b]?)?)\b/g;
  const chords = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') || trimmed.match(/^[eEbBgGdDaA]\|/)) continue;
    const hasWords = trimmed.match(/[a-z]{3,}/i);
    if (hasWords) continue;

    let match;
    while ((match = chordPattern.exec(trimmed)) !== null) {
      if (!['A', 'I', 'In', 'If', 'Am', 'As', 'At', 'Be', 'By', 'Do', 'Go'].includes(match[1]) ||
          match[1] === 'Am') {
        chords.add(match[1]);
      }
    }
  }

  return Array.from(chords);
}

function estimateDifficulty(notes: TabData['notes']): 'beginner' | 'intermediate' | 'advanced' {
  const maxFret = Math.max(0, ...notes.map((n) => n.fret));
  const hasTechniques = notes.some((n) => n.technique);
  if (maxFret <= 3 && !hasTechniques) return 'beginner';
  if (maxFret <= 7) return 'intermediate';
  return 'advanced';
}
