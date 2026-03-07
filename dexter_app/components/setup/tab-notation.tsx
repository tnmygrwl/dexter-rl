import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { StageCard } from '@/components/ui/stage-card';

interface TabNotationProps {
  rawText?: string;
}

/**
 * Renders the raw tab text in a scrollable monospace view.
 * Extracts and displays just the tab notation lines grouped by staff.
 */
export function TabNotation({ rawText }: TabNotationProps) {
  if (!rawText) return null;

  const lines = rawText.split('\n');
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isTabLine = /^[eEbBgGdDaA]\|/.test(trimmed);
    const isSectionHeader = /^\[.+\]$/.test(trimmed);
    const isChordLine = /^\s*[A-G][#b]?(?:m|7|maj|sus|add|dim|aug)?\s/.test(trimmed) &&
      !trimmed.includes('|');

    if (isSectionHeader) {
      if (current.length > 0) {
        groups.push([...current]);
        current = [];
      }
      groups.push([trimmed]);
    } else if (isChordLine) {
      if (current.length > 0 && !/^[eEbBgGdDaA]\|/.test(current[0])) {
        current.push(trimmed);
      } else {
        if (current.length > 0) groups.push([...current]);
        current = [trimmed];
      }
    } else if (isTabLine) {
      if (current.length > 0 && !/^[eEbBgGdDaA]\|/.test(current[0])) {
        groups.push([...current]);
        current = [trimmed];
      } else {
        current.push(trimmed);
      }
    } else if (trimmed === '' && current.length > 0) {
      groups.push([...current]);
      current = [];
    }
  }

  if (current.length > 0) groups.push(current);

  if (groups.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="label" style={styles.heading}>TAB NOTATION</ThemedText>
      <StageCard style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <ScrollView nestedScrollEnabled style={styles.scrollInner}>
            {groups.map((group, gi) => (
              <View key={gi} style={styles.group}>
                {group.map((line, li) => {
                  const isSectionHeader = /^\[.+\]$/.test(line);
                  const isTab = /^[eEbBgGdDaA]\|/.test(line);

                  return (
                    <ThemedText
                      key={li}
                      style={[
                        styles.tabLine,
                        isSectionHeader && styles.sectionHeader,
                        isTab && styles.tabNotation,
                      ]}
                    >
                      {line}
                    </ThemedText>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </StageCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  heading: {
    marginBottom: 8,
  },
  card: {
    padding: 12,
    maxHeight: 400,
  },
  scrollInner: {
    flexGrow: 1,
  },
  group: {
    marginBottom: 12,
  },
  tabLine: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.dark.textMuted,
  },
  sectionHeader: {
    color: Colors.dark.amber,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  tabNotation: {
    color: Colors.dark.text,
    fontSize: 13,
    lineHeight: 17,
  },
});
