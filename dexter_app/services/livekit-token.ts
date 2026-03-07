import { LIVEKIT_TOKEN_URL } from '@/config';
import { dlog } from '@/utils/debug-log';

const TAG = 'Token';

interface TokenResponse {
  token: string;
  url: string;
}

export async function fetchLiveKitToken(
  room = 'dexter-practice',
  identity = 'student',
): Promise<TokenResponse> {
  const url = `${LIVEKIT_TOKEN_URL}?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}`;
  dlog.info(TAG, `Fetching token from ${LIVEKIT_TOKEN_URL}`);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token fetch failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  if (!data.token) {
    throw new Error('Token response missing token field');
  }

  dlog.info(TAG, `Token received (${data.token.length} chars)`);
  return data;
}
