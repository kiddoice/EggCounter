/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
    dark: {
        background: '#0A0A0A',
        card: '#161616',
        text: '#FFFFFF',
        subText: '#888888',
        border: '#333333',
        primary: '#BB86FC',
        danger: '#F44336',
        success: '#4CAF50',
        dangerBg: 'rgba(244, 67, 54, 0.1)',
        badgeText: '#FFFFFF', // Forced white for contrast
    },
    light: {
        background: '#F0F2F5',
        card: '#FFFFFF',
        text: '#121212',
        subText: '#666666',
        border: '#E0E0E0',
        primary: '#6200EE',
        danger: '#D32F2F',
        success: '#388E3C',
        dangerBg: 'rgba(211, 47, 47, 0.1)',
        badgeText: '#FFFFFF', // Forced white for contrast
    }
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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
