import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { dlog, type LogEntry } from '@/utils/debug-log';

const LEVEL_COLOR: Record<string, string> = {
  info: Colors.dark.textMuted,
  warn: Colors.dark.amber,
  error: Colors.dark.red,
};

export function DebugLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    return dlog.subscribe(setEntries);
  }, []);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [entries, expanded]);

  if (!expanded) {
    const last = entries[entries.length - 1];
    return (
      <Pressable style={styles.collapsed} onPress={() => setExpanded(true)}>
        <ThemedText style={styles.collapseLabel}>LOG</ThemedText>
        {last && (
          <ThemedText
            style={[styles.lastEntry, { color: LEVEL_COLOR[last.level] }]}
            numberOfLines={1}
          >
            [{last.tag}] {last.message}
          </ThemedText>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <ThemedText style={styles.toolbarTitle}>Debug Log ({entries.length})</ThemedText>
        <Pressable onPress={() => dlog.clear()}>
          <ThemedText style={styles.toolbarAction}>Clear</ThemedText>
        </Pressable>
        <Pressable onPress={() => setExpanded(false)}>
          <ThemedText style={styles.toolbarAction}>Collapse</ThemedText>
        </Pressable>
      </View>
      <ScrollView ref={scrollRef} style={styles.scroll}>
        {entries.map((entry, i) => (
          <ThemedText
            key={i}
            style={[styles.entry, { color: LEVEL_COLOR[entry.level] ?? Colors.dark.textMuted }]}
          >
            {entry.time} [{entry.tag}] {entry.message}
          </ThemedText>
        ))}
        {entries.length === 0 && (
          <ThemedText style={styles.empty}>No log entries yet</ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
    gap: 8,
  },
  collapseLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.amber,
    letterSpacing: 1,
  },
  lastEntry: {
    flex: 1,
    fontFamily: Fonts?.mono,
    fontSize: 10,
  },
  container: {
    height: 200,
    backgroundColor: Colors.dark.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    gap: 12,
  },
  toolbarTitle: {
    flex: 1,
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  toolbarAction: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    color: Colors.dark.amber,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entry: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    lineHeight: 15,
  },
  empty: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
