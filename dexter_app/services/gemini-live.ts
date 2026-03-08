import { GEMINI_API_KEY, GEMINI_LIVE_MODEL } from '@/config';
import { dlog } from '@/utils/debug-log';

const TAG = 'GeminiLive';

// v1alpha works with more models than v1beta for BidiGenerateContent
const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

const COACHING_SYSTEM_PROMPT = `You are Dexter, an expert guitar instructor analyzing a student's playing in real-time.

The student is practicing a specific bar of a song. You will receive:
- Audio of their guitar playing via microphone
- Text context about which bar, section, and chords they should be playing

Respond with brief, specific coaching feedback. Mention which finger, string, or fret when relevant.
Be encouraging but honest. Keep responses to 1-2 sentences.

Also evaluate their performance numerically. Include a JSON block in your response:
{"pitchAccuracy": 0.0-1.0, "timing": 0.0-1.0, "fingerPosition": 0.0-1.0}

Scoring: 0.9-1.0 excellent, 0.7-0.89 good, 0.5-0.69 needs work, <0.5 significant problems.`;

type MessageCallback = (text: string) => void;

const isNativeAudioModel = (model: string) =>
  model.includes('native-audio');

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private messageListeners: MessageCallback[] = [];
  private setupComplete = false;
  private responseBuffer = '';

  connect(barContext?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!GEMINI_API_KEY) {
        reject(new Error('GEMINI_API_KEY is not set'));
        return;
      }

      const model = `models/${GEMINI_LIVE_MODEL}`;
      const useAudioResponse = isNativeAudioModel(GEMINI_LIVE_MODEL);
      dlog.info(TAG, `Connecting: model=${model} audioResponse=${useAudioResponse}`);

      const url = `${WS_URL}?key=${GEMINI_API_KEY}`;
      this.setupComplete = false;
      this.responseBuffer = '';

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        reject(new Error(`WebSocket failed: ${err}`));
        return;
      }

      let resolved = false;

      this.ws.onopen = () => {
        dlog.info(TAG, 'WebSocket OPEN — sending setup');

        const setup: any = {
          setup: {
            model,
            generationConfig: {
              temperature: 0.4,
              responseModalities: useAudioResponse ? ['AUDIO'] : ['TEXT'],
            },
            systemInstruction: {
              parts: [{
                text: COACHING_SYSTEM_PROMPT +
                  (barContext ? `\n\nCurrent practice context:\n${barContext}` : ''),
              }],
            },
          },
        };

        // Native audio models need a voice config
        if (useAudioResponse) {
          setup.setup.generationConfig.speechConfig = {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          };
        }

        this.ws?.send(JSON.stringify(setup));
        dlog.info(TAG, 'Setup sent, waiting for setupComplete...');
      };

      this.ws.onmessage = (event) => {
        const raw = String(event.data);
        try {
          const data = JSON.parse(raw);

          // Log first few messages and any with interesting keys
          const keys = Object.keys(data);
          dlog.info(TAG, `MSG keys=[${keys.join(',')}] ${raw.slice(0, 150)}`);

          if (data.setupComplete !== undefined) {
            this.setupComplete = true;
            dlog.info(TAG, 'setupComplete — ready!');
            if (!resolved) { resolved = true; resolve(); }
            return;
          }

          if (data.error) {
            const errMsg = data.error.message || JSON.stringify(data.error);
            dlog.error(TAG, `Server error: ${errMsg}`);
            if (!resolved) { resolved = true; reject(new Error(errMsg)); }
            return;
          }

          // Extract text parts from model turn
          const parts = data?.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.text) this.responseBuffer += part.text;
            }
          }

          if (data?.serverContent?.turnComplete && this.responseBuffer) {
            dlog.info(TAG, `Turn complete: "${this.responseBuffer.slice(0, 120)}"`);
            this.messageListeners.forEach((cb) => cb(this.responseBuffer));
            this.responseBuffer = '';
          }
        } catch {
          dlog.warn(TAG, `Non-JSON msg (${raw.length} bytes)`);
        }
      };

      this.ws.onerror = (ev) => {
        const msg = `WebSocket error: ${(ev as any)?.message ?? 'unknown'}`;
        dlog.error(TAG, msg);
        if (!resolved) { resolved = true; reject(new Error(msg)); }
      };

      this.ws.onclose = (ev) => {
        dlog.warn(TAG, `WebSocket closed: code=${ev.code} reason="${ev.reason}"`);
        this.setupComplete = false;
        if (!resolved) {
          resolved = true;
          reject(new Error(`Closed before setup: code=${ev.code} ${ev.reason}`));
        }
      };

      setTimeout(() => {
        if (!resolved) {
          dlog.error(TAG, `Setup timed out (model=${GEMINI_LIVE_MODEL})`);
          this.ws?.close();
          resolved = true;
          reject(new Error(`Setup timed out (model=${GEMINI_LIVE_MODEL})`));
        }
      }, 15000);
    });
  }

  sendText(text: string) {
    if (!this.ws || !this.setupComplete) return;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    }));
  }

  onMessage(callback: MessageCallback) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  disconnect() {
    dlog.info(TAG, 'Disconnecting');
    this.messageListeners = [];
    this.responseBuffer = '';
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.setupComplete = false;
  }

  get isConnected() {
    return this.setupComplete && this.ws?.readyState === WebSocket.OPEN;
  }
}
