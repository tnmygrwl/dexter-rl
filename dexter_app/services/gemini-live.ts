import { GEMINI_API_KEY, GEMINI_LIVE_MODEL } from '@/config';
import { dlog } from '@/utils/debug-log';
import type { GeminiFeedback } from '@/types/tab';

type FeedbackCallback = (feedback: GeminiFeedback) => void;

const TAG = 'GeminiLive';

const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const COACHING_SYSTEM_PROMPT = `You are an expert guitar instructor analyzing a student's playing in real-time via camera and microphone.

You will receive:
- Video frames showing the student's fretting hand and picking/strumming hand
- Audio of their guitar playing
- Context about which bar and chords they should be playing

For EVERY observation, respond with ONLY a JSON object matching this exact schema (no markdown, no extra text):

{
  "pitchAccuracy": <number 0-1>,
  "timing": <number 0-1>,
  "fingerPosition": <number 0-1>,
  "detectedChord": "<string or null>",
  "expectedChord": "<string or null>",
  "feedback": "<brief coaching tip, 1-2 sentences>"
}

Scoring: 0.9-1.0 excellent, 0.7-0.89 good, 0.5-0.69 needs work, <0.5 significant problems.
Be specific: mention which finger, string, fret. Be encouraging but honest.`;

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private feedbackListeners: FeedbackCallback[] = [];
  private setupComplete = false;
  private responseBuffer = '';

  connect(barContext?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!GEMINI_API_KEY) {
        const msg = 'GEMINI_API_KEY is not set – check your .env';
        dlog.error(TAG, msg);
        reject(new Error(msg));
        return;
      }

      const model = `models/${GEMINI_LIVE_MODEL}`;
      dlog.info(TAG, `Connecting with model: ${model}`);

      const url = `${WS_URL}?key=${GEMINI_API_KEY}`;
      dlog.info(TAG, `WebSocket URL: ${WS_URL}?key=***`);

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        const msg = `WebSocket constructor failed: ${err}`;
        dlog.error(TAG, msg);
        reject(new Error(msg));
        return;
      }

      this.setupComplete = false;
      this.responseBuffer = '';

      this.ws.onopen = () => {
        dlog.info(TAG, 'WebSocket OPEN – sending setup message');

        const setupMessage = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0.3,
            },
            systemInstruction: {
              parts: [
                {
                  text: COACHING_SYSTEM_PROMPT +
                    (barContext ? `\n\nCurrent bar context:\n${barContext}` : ''),
                },
              ],
            },
          },
        };

        dlog.info(TAG, `Setup payload model=${model}, modalities=[TEXT]`);
        this.ws?.send(JSON.stringify(setupMessage));
        dlog.info(TAG, 'Setup message sent, waiting for setupComplete...');
      };

      this.ws.onmessage = (event) => {
        const raw = String(event.data);
        try {
          const data = JSON.parse(raw);

          if (data.setupComplete !== undefined) {
            this.setupComplete = true;
            dlog.info(TAG, 'setupComplete received – connection ready');
            resolve();
            return;
          }

          // Check for server error
          if (data.error) {
            const errMsg = data.error.message || JSON.stringify(data.error);
            dlog.error(TAG, `Server error: ${errMsg}`);
            this.ws?.close();
            reject(new Error(`Gemini server error: ${errMsg}`));
            return;
          }

          // Extract text parts from model turn
          const parts = data?.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.text) {
                this.responseBuffer += part.text;
              }
            }
          }

          if (data?.serverContent?.turnComplete) {
            dlog.info(TAG, `Turn complete, buffer length=${this.responseBuffer.length}`);
            this.tryParseFeedback(this.responseBuffer);
            this.responseBuffer = '';
          }
        } catch {
          dlog.warn(TAG, `Unparseable WS message (${raw.length} bytes): ${raw.slice(0, 120)}`);
        }
      };

      this.ws.onerror = (event) => {
        const msg = `WebSocket error: ${(event as any)?.message ?? 'unknown'}`;
        dlog.error(TAG, msg);
        if (!this.setupComplete) {
          reject(new Error(msg));
        }
      };

      this.ws.onclose = (event) => {
        dlog.warn(TAG, `WebSocket closed: code=${event.code} reason="${event.reason}"`);
        this.setupComplete = false;
        if (!this.setupComplete) {
          reject(new Error(`WebSocket closed before setup: code=${event.code} ${event.reason}`));
        }
      };

      // Timeout
      setTimeout(() => {
        if (!this.setupComplete) {
          dlog.error(TAG, 'Setup timed out after 20s – closing WebSocket');
          this.ws?.close();
          reject(new Error(
            `Gemini Live setup timed out (model=${GEMINI_LIVE_MODEL}). ` +
            'Check that your API key supports the Live API and the model name is correct. ' +
            'Set EXPO_PUBLIC_GEMINI_LIVE_MODEL in your .env.'
          ));
        }
      }, 20000);
    });
  }

  private tryParseFeedback(text: string) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      dlog.warn(TAG, `No JSON found in response: "${text.slice(0, 200)}"`);
      return;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const feedback: GeminiFeedback = {
        pitchAccuracy: clamp(parsed.pitchAccuracy ?? 0),
        timing: clamp(parsed.timing ?? 0),
        fingerPosition: clamp(parsed.fingerPosition ?? 0),
        detectedChord: parsed.detectedChord ?? null,
        expectedChord: parsed.expectedChord ?? null,
        feedback: parsed.feedback ?? '',
      };
      dlog.info(TAG, `Feedback: pitch=${feedback.pitchAccuracy.toFixed(2)} timing=${feedback.timing.toFixed(2)} fingers=${feedback.fingerPosition.toFixed(2)}`);
      this.feedbackListeners.forEach((cb) => cb(feedback));
    } catch (err) {
      dlog.warn(TAG, `JSON parse failed: ${err}`);
    }
  }

  sendFrame(jpegBase64: string) {
    if (!this.ws || !this.setupComplete) return;
    dlog.info(TAG, `Sending frame (${Math.round(jpegBase64.length / 1024)}KB)`);
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            { mimeType: 'image/jpeg', data: jpegBase64 },
          ],
        },
      }),
    );
  }

  sendAudio(pcmBase64: string) {
    if (!this.ws || !this.setupComplete) return;
    dlog.info(TAG, `Sending audio (${Math.round(pcmBase64.length / 1024)}KB)`);
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            { mimeType: 'audio/pcm;rate=16000', data: pcmBase64 },
          ],
        },
      }),
    );
  }

  sendBarContext(barInfo: string) {
    if (!this.ws || !this.setupComplete) return;
    dlog.info(TAG, `Sending bar context (${barInfo.length} chars)`);
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            { role: 'user', parts: [{ text: barInfo }] },
          ],
          turnComplete: true,
        },
      }),
    );
  }

  onFeedback(callback: FeedbackCallback) {
    this.feedbackListeners.push(callback);
    return () => {
      this.feedbackListeners = this.feedbackListeners.filter((cb) => cb !== callback);
    };
  }

  disconnect() {
    dlog.info(TAG, 'Disconnecting');
    this.feedbackListeners = [];
    this.responseBuffer = '';
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setupComplete = false;
  }

  get isConnected() {
    return this.setupComplete && this.ws?.readyState === WebSocket.OPEN;
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
