import { useCallback, useState } from 'react';
import { USE_MOCK_DATA } from '@/config';
import { fetchSongDetail, buildSongContext } from '@/services/songsterr';
import { generateTabWithGemini, parseTabWithGemini } from '@/services/gemini';
import { getMockRawTab } from '@/services/browserbase-mock';
import type { SongSearchResult, TabData } from '@/types/tab';

export type TabLoadStage = 'idle' | 'fetching' | 'generating' | 'ready' | 'error';

export function useTabData() {
  const [tabData, setTabData] = useState<TabData | null>(null);
  const [stage, setStage] = useState<TabLoadStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadTab = useCallback(async (song: SongSearchResult) => {
    setError(null);
    setTabData(null);

    try {
      // Mock mode: use hardcoded tab data + local parser
      if (USE_MOCK_DATA) {
        setStage('generating');
        const mockRaw = getMockRawTab(song.title, song.artist);
        if (mockRaw) {
          const parsed = await parseTabWithGemini(mockRaw);
          parsed.metadata.title = parsed.metadata.title || song.title;
          parsed.metadata.artist = parsed.metadata.artist || song.artist;
          setTabData(parsed);
          setStage('ready');
          return;
        }
        // No mock data for this song — fall through to live API
      }

      // Live mode: Songsterr metadata → Gemini generation
      setStage('fetching');
      const detail = await fetchSongDetail(song.id);
      const context = buildSongContext(detail);

      setStage('generating');
      const generated = await generateTabWithGemini(context);

      generated.metadata.title = generated.metadata.title || song.title;
      generated.metadata.artist = generated.metadata.artist || song.artist;

      setTabData(generated);
      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tab');
      setStage('error');
    }
  }, []);

  const reset = useCallback(() => {
    setTabData(null);
    setStage('idle');
    setError(null);
  }, []);

  return { tabData, stage, error, loadTab, reset };
}
