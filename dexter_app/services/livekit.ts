import {
  Room,
  RoomEvent,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  DataPacket_Kind,
  type RemoteParticipant,
  type LocalVideoTrack,
  type LocalAudioTrack,
} from 'livekit-client';
import { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from '@/config';
import { dlog } from '@/utils/debug-log';
import type { GeminiFeedback } from '@/types/tab';

const TAG = 'LiveKit';

type FeedbackCallback = (feedback: GeminiFeedback) => void;

/**
 * Manages the LiveKit room connection for the practice session.
 * The client publishes camera + mic tracks.
 * The Python agent in the same room receives them, sends to Gemini,
 * and sends coaching feedback back via data channel.
 */
export class LiveKitSession {
  private room: Room | null = null;
  private videoTrack: LocalVideoTrack | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private feedbackListeners: FeedbackCallback[] = [];

  async connect(token: string, barContext?: string): Promise<void> {
    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not set – check your .env');
    }

    dlog.info(TAG, `Connecting to ${LIVEKIT_URL}`);

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    this.room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      this.handleDataMessage(payload, participant as RemoteParticipant | undefined);
    });

    this.room.on(RoomEvent.Disconnected, () => {
      dlog.warn(TAG, 'Room disconnected');
    });

    this.room.on(RoomEvent.ParticipantConnected, (p) => {
      dlog.info(TAG, `Participant joined: ${p.identity}`);
    });

    try {
      await this.room.connect(LIVEKIT_URL, token);
      dlog.info(TAG, `Connected to room: ${this.room.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dlog.error(TAG, `Connection failed: ${msg}`);
      throw new Error(`LiveKit connection failed: ${msg}`);
    }

    // Publish camera
    try {
      this.videoTrack = await createLocalVideoTrack({
        facingMode: 'environment',
        resolution: { width: 640, height: 480, frameRate: 5 },
      });
      await this.room.localParticipant.publishTrack(this.videoTrack);
      dlog.info(TAG, 'Camera track published');
    } catch (err) {
      dlog.warn(TAG, `Camera publish failed: ${err}`);
    }

    // Publish microphone
    try {
      this.audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
      });
      await this.room.localParticipant.publishTrack(this.audioTrack);
      dlog.info(TAG, 'Audio track published');
    } catch (err) {
      dlog.warn(TAG, `Audio publish failed: ${err}`);
    }

    // Send bar context to the agent via data channel
    if (barContext) {
      this.sendData({ type: 'barContext', data: barContext });
    }
  }

  sendData(message: Record<string, unknown>) {
    if (!this.room) return;
    const payload = new TextEncoder().encode(JSON.stringify(message));
    this.room.localParticipant.publishData(payload, { reliable: true });
    dlog.info(TAG, `Data sent: ${(message as any).type ?? 'unknown'}`);
  }

  sendBarContext(barInfo: string) {
    this.sendData({ type: 'barContext', data: barInfo });
  }

  private handleDataMessage(payload: Uint8Array, participant?: RemoteParticipant) {
    try {
      const text = new TextDecoder().decode(payload);
      const msg = JSON.parse(text);

      if (msg.type === 'feedback' && msg.data) {
        const fb = msg.data as GeminiFeedback;
        const feedback: GeminiFeedback = {
          pitchAccuracy: clamp(fb.pitchAccuracy ?? 0),
          timing: clamp(fb.timing ?? 0),
          fingerPosition: clamp(fb.fingerPosition ?? 0),
          detectedChord: fb.detectedChord ?? null,
          expectedChord: fb.expectedChord ?? null,
          feedback: fb.feedback ?? '',
        };
        dlog.info(TAG, `Feedback from ${participant?.identity ?? 'agent'}: pitch=${feedback.pitchAccuracy.toFixed(2)}`);
        this.feedbackListeners.forEach((cb) => cb(feedback));
      } else {
        dlog.info(TAG, `Data message: ${msg.type ?? 'unknown'} from ${participant?.identity ?? '?'}`);
      }
    } catch {
      dlog.warn(TAG, `Unparseable data message (${payload.length} bytes)`);
    }
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

    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    if (this.audioTrack) {
      this.audioTrack.stop();
      this.audioTrack = null;
    }
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }

  get isConnected() {
    return this.room?.state === 'connected';
  }

  get localVideoTrack() {
    return this.videoTrack;
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
