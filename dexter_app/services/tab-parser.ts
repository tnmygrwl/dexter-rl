/**
 * Strips HTML tags, normalizes whitespace, and extracts tab notation
 * from raw page content. The cleaned text is then ready for Gemini parsing.
 */
export function preprocessTab(rawHtml: string): string {
  let text = rawHtml;

  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, '\n');

  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#\d+;/g, '');
  text = text.replace(/&\w+;/g, '');

  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Attempts to extract just the tab notation lines from cleaned text.
 * Tab lines typically look like: e|---0---2---| or E|---0---2---|
 */
export function extractTabLines(cleanText: string): string {
  const lines = cleanText.split('\n');
  const tabLinePattern = /^[eEbBgGdDaA]\|[\d\-hpbs\/\\|~x\s]+\|?\s*$/;
  const tabGroups: string[][] = [];
  let currentGroup: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (tabLinePattern.test(trimmed)) {
      currentGroup.push(trimmed);
    } else if (currentGroup.length > 0) {
      if (currentGroup.length >= 4) {
        tabGroups.push([...currentGroup]);
      }
      currentGroup = [];
    }
  }

  if (currentGroup.length >= 4) {
    tabGroups.push(currentGroup);
  }

  if (tabGroups.length > 0) {
    return tabGroups.map((group) => group.join('\n')).join('\n\n');
  }

  return cleanText;
}
