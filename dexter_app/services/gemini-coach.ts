import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '@/config';
import { dlog } from '@/utils/debug-log';

const TAG = 'GeminiCoach';

const SYSTEM_PROMPT = `You are Dexter, an expert guitar instructor giving real-time coaching.

You receive performance metrics from a student practicing a specific bar of a song.
Based on the metrics, give ONE brief coaching tip (1 sentence max).

Be specific: mention fingers, frets, strings, technique.
Be encouraging but honest.
Match the energy — if they're doing well, celebrate. If struggling, be constructive.

IMPORTANT: Respond with ONLY the coaching tip text. No JSON, no labels, no extra formatting.`;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI;
}

interface CoachingRequest {
  songTitle: string;
  artist: string;
  barNumber: number;
  totalBars: number;
  sectionName: string;
  expectedChords: string[];
  pitchAccuracy: number;
  timing: number;
  fingerPosition: number;
  detectedHz: number;
}

export async function getCoachingTip(req: CoachingRequest): Promise<string> {
  if (!GEMINI_API_KEY) return '';

  const prompt = `Song: ${req.songTitle} by ${req.artist}
Bar ${req.barNumber} of ${req.totalBars} (${req.sectionName})
Expected chords: ${req.expectedChords.join(' → ')}

Current performance:
- Pitch accuracy: ${Math.round(req.pitchAccuracy * 100)}%
- Timing: ${Math.round(req.timing * 100)}%  
- Finger position: ${Math.round(req.fingerPosition * 100)}%
- Detected frequency: ${req.detectedHz > 0 ? `${Math.round(req.detectedHz)}Hz` : 'no clear pitch'}

Give one brief coaching tip.`;

  try {
    const model = getGenAI().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    dlog.info(TAG, `Tip: "${text.slice(0, 80)}"`);
    return text;
  } catch (err) {
    dlog.warn(TAG, `Failed: ${err}`);
    return '';
  }
}
