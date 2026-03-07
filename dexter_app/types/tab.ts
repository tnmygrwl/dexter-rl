export interface TabNote {
  bar: number;
  beat: number;
  /** 1 = high E, 6 = low E */
  string: number;
  fret: number;
  /** Duration in beats */
  duration: number;
  technique?: 'hammer-on' | 'pull-off' | 'slide' | 'bend' | 'vibrato';
}

export interface SongSection {
  name: string;
  startBar: number;
  endBar: number;
  chords: string[];
}

export interface SongMetadata {
  title: string;
  artist: string;
  key: string;
  tempo: number;
  timeSignature: [number, number];
  tuning: string[];
  capo: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface TabData {
  metadata: SongMetadata;
  sections: SongSection[];
  notes: TabNote[];
  rawText?: string;
}

export interface SongSearchResult {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  tabUrl?: string;
  tracks?: { instrument: string; tuning?: string[] }[];
}
