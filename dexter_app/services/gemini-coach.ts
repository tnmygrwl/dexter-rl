import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@/config';
import { dlog } from '@/utils/debug-log';

const TAG = 'GeminiCoach';

const SYSTEM_PROMPT = `You are Dexter, an expert guitar instructor providing real-time coaching.

You receive:
- A camera image showing the student's hands on the guitar
- Song context (title, artist, key, tempo, current bar, expected chords/notes)
- Audio analysis data (detected pitch frequency, amplitude, whether they're playing)

Analyze BOTH the image and the audio data to give comprehensive feedback:

- **What you SEE**: Hand position, finger placement on frets, pick grip, posture
- **What you HEAR** (from audio data): Pitch accuracy, whether notes match the expected chords
- **Technique tips**: Specific to this bar of this song — mention exact frets, strings, fingers
- **Encouragement**: Celebrate what's going well

Keep it to 2-3 sentences. Be conversational, like a real instructor sitting next to them.
If you can see the guitar neck in the image, reference specific things you observe.
If the image is unclear, focus on the audio data and song-specific tips.

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
  frameBase64?: string;
}

export async function getCoachingFeedback(req: CoachingRequest): Promise<string> {
  if (!GEMINI_API_KEY) return '';

  const playingStatus = req.isPlaying
    ? `Student IS playing (amplitude: ${req.amplitude.toFixed(3)}, detected frequency: ${req.detectedHz > 0 ? `${Math.round(req.detectedHz)}Hz` : 'unclear'})`
    : 'Student is NOT playing — silence detected';

  const textPrompt = `SONG: "${req.songTitle}" by ${req.artist}
KEY: ${req.key} | TEMPO: ${req.tempo} BPM
BAR: ${req.barNumber} of ${req.totalBars} (${req.sectionName})
EXPECTED CHORDS: ${req.expectedChords.join(' → ')}
EXPECTED NOTES: ${req.expectedNotes}

AUDIO STATUS: ${playingStatus}
TIME ON THIS BAR: ${Math.round(req.elapsedSeconds)}s

Look at the image of the student's hands and analyze their playing. What coaching feedback do you have?`;

  try {
    const model = getGenAI().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    const parts: any[] = [];

    // Include camera frame if available (multimodal)
    if (req.frameBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: req.frameBase64,
        },
      });
      dlog.info(TAG, `Sending with image (${Math.round(req.frameBase64.length / 1024)}KB)`);
    }

    parts.push({ text: textPrompt });

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    dlog.info(TAG, `Feedback: "${text.slice(0, 100)}"`);
    return text;
  } catch (err) {
    dlog.warn(TAG, `Failed: ${err}`);
    return '';
  }
}
