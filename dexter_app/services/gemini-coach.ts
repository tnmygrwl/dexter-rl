import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@/config';
import { dlog } from '@/utils/debug-log';

const TAG = 'GeminiCoach';

const SYSTEM_PROMPT = `You are Dexter, an expert guitar instructor providing real-time coaching to a student practicing a song.

You receive:
- The song context (title, artist, key, tempo, current bar, expected chords/notes)
- Audio analysis data (detected pitch frequency, amplitude, whether sound is detected)
- Video context (camera is watching the student's hands on the guitar)

Based on this information, provide comprehensive text feedback about their playing. Cover what's relevant:

- **Pitch & notes**: Are they hitting the right notes? Is intonation sharp/flat?
- **Rhythm & timing**: Are they in time with the tempo? Rushing or dragging?
- **Technique**: Fretting hand position, pick attack, muting, transitions between chords
- **Song-specific tips**: Reference the actual chords, frets, and strings for this bar of this song
- **Encouragement**: Celebrate what's going well

Keep it to 2-3 sentences. Be conversational, like a real instructor sitting next to them.
Reference the specific song, section, and chords they're working on.

IMPORTANT: Respond with ONLY the coaching text. No JSON, no labels, no markdown.`;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI;
}

export interface CoachingRequest {
  songTitle: string;
  artist: string;
  key: string;
  tempo: number;
  barNumber: number;
  totalBars: number;
  sectionName: string;
  expectedChords: string[];
  expectedNotes: string;
  detectedHz: number;
  amplitude: number;
  isPlaying: boolean;
  elapsedSeconds: number;
}

export async function getCoachingFeedback(req: CoachingRequest): Promise<string> {
  if (!GEMINI_API_KEY) return '';

  const playingStatus = req.isPlaying
    ? `Student IS playing (amplitude: ${req.amplitude.toFixed(3)}, detected frequency: ${req.detectedHz > 0 ? `${Math.round(req.detectedHz)}Hz` : 'unclear'})`
    : 'Student is NOT playing — silence detected';

  const prompt = `SONG: "${req.songTitle}" by ${req.artist}
KEY: ${req.key} | TEMPO: ${req.tempo} BPM
BAR: ${req.barNumber} of ${req.totalBars} (${req.sectionName})
EXPECTED CHORDS: ${req.expectedChords.join(' → ')}
EXPECTED NOTES: ${req.expectedNotes}

AUDIO STATUS: ${playingStatus}
TIME ON THIS BAR: ${Math.round(req.elapsedSeconds)}s

What coaching feedback do you have for the student right now?`;

  try {
    const model = getGenAI().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    dlog.info(TAG, `Feedback: "${text.slice(0, 100)}"`);
    return text;
  } catch (err) {
    dlog.warn(TAG, `Failed: ${err}`);
    return '';
  }
}
