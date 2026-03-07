import { useCallback, useRef, useState } from 'react';
import { searchSongs } from '@/services/songsterr';
import type { SongSearchResult } from '@/types/tab';

export function useSongSearch() {
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query.trim()) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const songs = await searchSongs(query);
        if (!controller.signal.aborted) {
          setResults(songs);
          setIsLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
          setIsLoading(false);
        }
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { results, isLoading, error, search, clear };
}
