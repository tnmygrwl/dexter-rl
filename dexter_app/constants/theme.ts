import { Platform } from 'react-native';

export const Colors = {
  dark: {
    background: '#0A0A0F',
    surface: '#141419',
    surfaceLight: '#1C1C24',
    text: '#E8E8ED',
    textMuted: '#6B6B76',
    tint: '#F5A623',
    amber: '#F5A623',
    green: '#4ADE80',
    red: '#EF4444',
    icon: '#6B6B76',
    tabIconDefault: '#6B6B76',
    tabIconSelected: '#F5A623',
    border: '#2A2A35',
    inputBackground: '#111116',
  },
  light: {
    background: '#0A0A0F',
    surface: '#141419',
    surfaceLight: '#1C1C24',
    text: '#E8E8ED',
    textMuted: '#6B6B76',
    tint: '#F5A623',
    amber: '#F5A623',
    green: '#4ADE80',
    red: '#EF4444',
    icon: '#6B6B76',
    tabIconDefault: '#6B6B76',
    tabIconSelected: '#F5A623',
    border: '#2A2A35',
    inputBackground: '#111116',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
