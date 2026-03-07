import { BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, USE_MOCK_DATA } from '@/config';
import { preprocessTab } from './tab-parser';
import { getMockRawTab } from './browserbase-mock';

const API_BASE = 'https://api.browserbase.com/v1';

interface BrowserbaseSession {
  id: string;
  connectUrl: string;
  status: string;
}

async function createSession(): Promise<BrowserbaseSession> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bb-api-key': BROWSERBASE_API_KEY,
    },
    body: JSON.stringify({
      projectId: BROWSERBASE_PROJECT_ID,
    }),
  });

  if (!res.ok) {
    throw new Error(`Browserbase session creation failed: ${res.status}`);
  }

  return res.json();
}

async function getSessionConnectUrl(sessionId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: { 'x-bb-api-key': BROWSERBASE_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Failed to get session details: ${res.status}`);
  }

  const data = await res.json();
  return data.connectUrl;
}

/**
 * Scrapes a tab page via CDP over WebSocket.
 * Sends Page.navigate + Runtime.evaluate commands to extract page content.
 */
async function scrapeViaCDP(connectUrl: string, targetUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(connectUrl);
    let messageId = 1;

    const send = (method: string, params: Record<string, unknown> = {}): number => {
      const id = messageId++;
      ws.send(JSON.stringify({ id, method, params }));
      return id;
    };

    ws.onopen = () => {
      send('Page.enable');
      send('Page.navigate', { url: targetUrl });
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));

      if (msg.method === 'Page.loadEventFired') {
        // Page loaded; extract body text
        send('Runtime.evaluate', {
          expression: 'document.body.innerText',
          returnByValue: true,
        });
      }

      if (msg.result?.result?.value && typeof msg.result.result.value === 'string') {
        ws.close();
        resolve(msg.result.result.value);
      }
    };

    ws.onerror = (err) => {
      reject(new Error(`CDP WebSocket error: ${err}`));
    };

    setTimeout(() => {
      ws.close();
      reject(new Error('CDP scrape timed out after 30s'));
    }, 30000);
  });
}

async function closeSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'x-bb-api-key': BROWSERBASE_API_KEY },
    });
  } catch {
    // best-effort cleanup
  }
}

/**
 * Fetches raw tab content for a given song URL.
 * Falls back to mock data when USE_MOCK_DATA is true or on failure.
 */
export async function fetchTabContent(
  songTitle: string,
  songArtist: string,
  tabUrl?: string,
): Promise<string> {
  if (USE_MOCK_DATA) {
    const mockData = getMockRawTab(songTitle, songArtist);
    if (mockData) return mockData;
  }

  if (!tabUrl) {
    throw new Error('No tab URL provided and no mock data available');
  }

  let session: BrowserbaseSession | null = null;
  try {
    session = await createSession();
    const connectUrl = await getSessionConnectUrl(session.id);
    const rawHtml = await scrapeViaCDP(connectUrl, tabUrl);
    return preprocessTab(rawHtml);
  } finally {
    if (session) {
      closeSession(session.id);
    }
  }
}
