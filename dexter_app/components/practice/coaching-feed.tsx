import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { StageCard } from '@/components/ui/stage-card';

interface CoachingFeedProps {
  messages: string[];
  isActive: boolean;
}

export function CoachingFeed({ messages, isActive }: CoachingFeedProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  return (
    <StageCard style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={styles.headerLabel}>AI COACH</ThemedText>
        {isActive && (
          <View style={styles.listeningBadge}>
            <View style={styles.listeningDot} />
            <ThemedText style={styles.listeningText}>LISTENING</ThemedText>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {messages.length === 0 && (
          <ThemedText style={styles.placeholder}>
            {isActive
              ? 'Listening... Play something and I\'ll give you feedback.'
              : 'Tap Start Bar to begin practicing.'}
          </ThemedText>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.messageBubble, i === messages.length - 1 && styles.latestBubble]}
          >
            <ThemedText style={styles.messageText}>{msg}</ThemedText>
          </View>
        ))}
      </ScrollView>
    </StageCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    flex: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.dark.amber,
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.green,
  },
  listeningText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.dark.green,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  placeholder: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageBubble: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.border,
  },
  latestBubble: {
    borderLeftColor: Colors.dark.amber,
    backgroundColor: Colors.dark.surface,
  },
  messageText: {
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 19,
  },
});
