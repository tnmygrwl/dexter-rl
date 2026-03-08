export const BROWSERBASE_API_KEY =
  process.env.EXPO_PUBLIC_BROWSERBASE_API_KEY ?? '';

export const BROWSERBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_BROWSERBASE_PROJECT_ID ?? '';

export const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export const USE_MOCK_DATA =
  process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false';

// ── LiveKit ──────────────────────────────────

export const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';

export const LIVEKIT_API_KEY =
  process.env.EXPO_PUBLIC_LIVEKIT_API_KEY ?? '';

export const LIVEKIT_API_SECRET =
  process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET ?? '';

export const LIVEKIT_TOKEN_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_URL ?? 'http://localhost:8082/token';

/**
 * Gemini model to use for tab generation / parsing.
 *
 * Available options (as of March 2026):
 *   "gemini-2.5-flash"              — stable, fast, GA (retires Jun 2026)
 *   "gemini-2.5-pro"                — stable, high quality, GA
 *   "gemini-3-flash-preview"        — frontier-class speed, preview
 *   "gemini-3.1-flash-lite-preview" — budget, preview
 *   "gemini-3.1-pro-preview"        — best quality, 1M context, preview
 */
export const GEMINI_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.5-flash';

/**
 * Gemini model for Live API (BidiGenerateContent over WebSocket).
 *
 * Models supporting bidiGenerateContent (verified via ListModels):
 *   "gemini-2.0-flash-exp-image-generation"  — text responses, recommended
 *   "gemini-2.5-flash-native-audio-latest"   — audio responses only
 */
export const GEMINI_LIVE_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_LIVE_MODEL ?? 'gemini-2.0-flash-exp-image-generation';
