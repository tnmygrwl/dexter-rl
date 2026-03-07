import { useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { SongSearchResult } from '@/types/tab';

interface SongSearchProps {
  query: string;
  onQueryChange: (text: string) => void;
  results: SongSearchResult[];
  isLoading: boolean;
  error: string | null;
  onSelectSong: (song: SongSearchResult) => void;
}

export function SongSearch({
  query,
  onQueryChange,
  results,
  isLoading,
  error,
  onSelectSong,
}: SongSearchProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <ThemedText style={styles.searchIcon}>{'⌕'}</ThemedText>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search for a song..."
            placeholderTextColor={Colors.dark.textMuted}
            value={query}
            onChangeText={onQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isLoading && (
            <ActivityIndicator size="small" color={Colors.dark.amber} style={styles.spinner} />
          )}
        </View>
      </View>

      {error && (
        <ThemedText style={styles.error}>{error}</ThemedText>
      )}

      {results.length > 0 && (
        <View style={styles.list}>
          {results.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.resultItem,
                pressed && styles.resultItemPressed,
              ]}
              onPress={() => onSelectSong(item)}
            >
              <View style={styles.resultContent}>
                <ThemedText style={styles.songTitle} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.songArtist} numberOfLines={1}>
                  {item.artist}
                </ThemedText>
              </View>
              {item.tracks && item.tracks.length > 0 && (
                <View style={styles.trackBadges}>
                  {item.tracks.slice(0, 3).map((track, i) => (
                    <View key={i} style={styles.badge}>
                      <ThemedText style={styles.badgeText}>{track.instrument}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    fontSize: 20,
    color: Colors.dark.textMuted,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    fontFamily: Fonts?.sans,
    paddingVertical: 0,
  },
  spinner: {
    marginLeft: 8,
  },
  error: {
    color: Colors.dark.red,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    // no maxHeight — parent ScrollView handles scrolling
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  resultItemPressed: {
    backgroundColor: Colors.dark.surface,
  },
  resultContent: {
    flex: 1,
    marginRight: 12,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  songArtist: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  trackBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
