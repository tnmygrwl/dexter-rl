export const BROWSERBASE_API_KEY =
  process.env.EXPO_PUBLIC_BROWSERBASE_API_KEY ?? '';

export const BROWSERBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_BROWSERBASE_PROJECT_ID ?? '';

export const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export const USE_MOCK_DATA =
  process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false';

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
