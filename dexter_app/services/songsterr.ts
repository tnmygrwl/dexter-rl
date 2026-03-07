import { Platform } from 'react-native';
import { LIVEKIT_TOKEN_URL } from '@/config';
import type { SongSearchResult } from '@/types/tab';

/**
 * On web, Songsterr blocks CORS so we proxy through the local dev server.
 * On native (RN), we call Songsterr directly (no CORS restrictions).
 */
function getBaseUrl(): string {
  if (Platform.OS === 'web') {
    // Derive proxy base from the token server URL (same host, different path)
    const tokenUrl = LIVEKIT_TOKEN_URL || 'http://localhost:8081/token';
    const origin = tokenUrl.replace(/\/token$/, '');
    return `${origin}/api/songsterr`;
  }
  return 'https://www.songsterr.com/api';
}

interface SongsterrTrack {
  instrumentId: number;
  instrument: string;
  views: number;
  name: string;
  difficulty?: number;
  hash: string;
  tuning?: number[];
}

interface SongsterrSong {
  songId: number;
  artistId: number;
  artist: string;
  title: string;
  hasChords: boolean;
  hasPlayer: boolean;
  tracks: SongsterrTrack[];
  defaultTrack?: number;
  popularTrack?: number;
}

interface SongsterrRevisionSummary {
  songId: number;
  revisionId: number;
  artist: string;
  title: string;
}

export interface SongsterrRevisionDetail {
  revisionId: number;
  songId: number;
  artist: string;
  title: string;
  tracks: SongsterrTrack[];
  tags?: string[];
  source?: string;
  defaultTrack?: number;
}

function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[midi % 12];
}

function simplifyInstrument(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('guitar')) return 'Guitar';
  if (lower.includes('bass')) return 'Bass';
  if (lower.includes('drum') || lower.includes('percussion')) return 'Drums';
  if (lower.includes('vocal') || lower.includes('sax')) return 'Vocals';
  if (lower.includes('piano') || lower.includes('key') || lower.includes('organ')) return 'Keys';
  return raw;
}

export async function searchSongs(query: string): Promise<SongSearchResult[]> {
  if (!query.trim()) return [];

  const BASE_URL = getBaseUrl();
  const encoded = encodeURIComponent(query.trim());
  const res = await fetch(`${BASE_URL}/songs?pattern=${encoded}`);

  if (!res.ok) {
    throw new Error(`Songsterr search failed: ${res.status}`);
  }

  const data: SongsterrSong[] = await res.json();

  return data.slice(0, 20).map((song) => {
    const uniqueInstruments = [
      ...new Set(song.tracks.map((t) => simplifyInstrument(t.instrument))),
    ];

    return {
      id: song.songId,
      title: song.title,
      artist: song.artist,
      artistId: song.artistId,
      tabUrl: `https://www.songsterr.com/a/wsa/${song.artist.toLowerCase().replace(/\s+/g, '-')}-${song.title.toLowerCase().replace(/\s+/g, '-')}-tab-s${song.songId}`,
      tracks: uniqueInstruments.map((inst) => ({ instrument: inst })),
    };
  });
}

export async function fetchSongDetail(songId: number): Promise<SongsterrRevisionDetail> {
  const BASE_URL = getBaseUrl();

  const revisionsRes = await fetch(`${BASE_URL}/meta/${songId}/revisions`);
  if (!revisionsRes.ok) {
    throw new Error(`Failed to fetch revisions: ${revisionsRes.status}`);
  }
  const revisions: SongsterrRevisionSummary[] = await revisionsRes.json();
  if (revisions.length === 0) {
    throw new Error('No revisions found for this song');
  }
  const latestRevisionId = revisions[0].revisionId;

  const detailRes = await fetch(`${BASE_URL}/revision/${latestRevisionId}`);
  if (!detailRes.ok) {
    throw new Error(`Failed to fetch revision detail: ${detailRes.status}`);
  }

  return detailRes.json();
}

export function buildSongContext(detail: SongsterrRevisionDetail): string {
  const guitarTracks = detail.tracks.filter(
    (t) => t.instrument.toLowerCase().includes('guitar'),
  );

  const lines: string[] = [
    `Song: ${detail.title}`,
    `Artist: ${detail.artist}`,
  ];

  if (detail.tags?.length) {
    lines.push(`Genre/Tags: ${detail.tags.join(', ')}`);
  }

  lines.push(`Total tracks: ${detail.tracks.length}`);

  for (const track of guitarTracks) {
    const tuningStr = track.tuning
      ? track.tuning.map(midiToNote).join(' ')
      : 'Standard';
    const diffLabel = track.difficulty != null
      ? ['', 'Easy', 'Medium', 'Hard'][track.difficulty] ?? `${track.difficulty}`
      : 'Unknown';

    lines.push(`\nGuitar Track: ${track.name}`);
    lines.push(`  Instrument: ${track.instrument}`);
    lines.push(`  Tuning (low→high): ${tuningStr}`);
    lines.push(`  Difficulty: ${diffLabel}`);
    lines.push(`  Views: ${track.views.toLocaleString()}`);
  }

  const nonGuitarSummary = detail.tracks
    .filter((t) => !t.instrument.toLowerCase().includes('guitar'))
    .map((t) => `${t.name} (${t.instrument})`)
    .join(', ');

  if (nonGuitarSummary) {
    lines.push(`\nOther instruments: ${nonGuitarSummary}`);
  }

  return lines.join('\n');
}
