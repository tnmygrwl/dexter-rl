import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LedText } from '@/components/ui/led-text';
import { SongSearch } from '@/components/setup/song-search';
import { TabPreview } from '@/components/setup/tab-preview';
import { useSongSearch } from '@/hooks/use-song-search';
import { useTabData, type TabLoadStage } from '@/hooks/use-tab-data';
import { useSession } from '@/context/session-context';
import type { SongSearchResult } from '@/types/tab';

const STAGE_LABELS: Record<TabLoadStage, string> = {
  idle: '',
  fetching: 'Fetching song details...',
  generating: 'Generating tab structure...',
  ready: '',
  error: '',
};

export default function SetupScreen() {
  const [query, setQuery] = useState('');
  const { results, isLoading: isSearching, error: searchError, search, clear: clearSearch } = useSongSearch();
  const { tabData, stage, error: tabError, loadTab, reset: resetTab } = useTabData();
  const session = useSession();

  useEffect(() => {
    if (tabData && stage === 'ready') {
      session.setTabData(tabData);
    }
  }, [tabData, stage]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    search(text);
    if (tabData) resetTab();
  };

  const handleSelectSong = (song: SongSearchResult) => {
    clearSearch();
    setQuery('');
    loadTab(song);
  };

  const handleBack = () => {
    resetTab();
    session.resetSession();
    setQuery('');
  };

  const showSearch = stage === 'idle' || stage === 'error';
  const showLoading = stage === 'fetching' || stage === 'generating';
  const showPreview = stage === 'ready' && tabData;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <LedText size="lg" style={styles.logo}>DEXTER</LedText>
          <ThemedText style={styles.subtitle}>Guitar Learning AI</ThemedText>
        </View>

        {showSearch && (
          <SongSearch
            query={query}
            onQueryChange={handleQueryChange}
            results={results}
            isLoading={isSearching}
            error={searchError || tabError}
            onSelectSong={handleSelectSong}
          />
        )}

        {showLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingPulse}>
              <ActivityIndicator size="large" color={Colors.dark.amber} />
            </View>
            <LedText size="sm" style={styles.loadingText}>
              {STAGE_LABELS[stage]}
            </LedText>
            <View style={styles.loadingDots}>
              {['fetching', 'generating', 'ready'].map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    (stage === 'fetching' && i === 0) ||
                    (stage === 'generating' && i <= 1)
                      ? styles.dotActive
                      : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {showPreview && (
          <TabPreview
            tabData={tabData}
            onBack={handleBack}
            onStartPractice={() => router.push('/practice' as never)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    letterSpacing: 6,
    fontFamily: Fonts?.mono,
    textShadowColor: 'rgba(245, 166, 35, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    letterSpacing: 2,
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  loadingPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.dark.amber,
  },
  dotInactive: {
    backgroundColor: Colors.dark.border,
  },
});
