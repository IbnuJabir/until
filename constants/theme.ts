/**
 * Material Design 3 Theme with Warm Color Palette
 * Warm tones: Orange, Pink, Amber
 */

import { Platform } from 'react-native';

// Warm Color Palette - Refined Scandinavian Warmth
export const WarmColors = {
  // Primary - Terracotta/Warm Orange
  primary: '#E87461',
  primaryLight: '#F19B8E',
  primaryDark: '#D45F4D',

  // Secondary - Dusty Rose
  secondary: '#E88C9C',
  secondaryLight: '#F2A8B4',
  secondaryDark: '#D47184',

  // Accent - Warm Sand/Amber
  accent: '#F4A261',
  accentLight: '#F7BC88',
  accentDark: '#E08A47',

  // Backgrounds - Softer, warmer whites
  background: '#FEFDFB',
  backgroundLight: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceVariant: '#F9F5F0',
  surfaceWarm: '#FFF9F4',

  // Text - More refined hierarchy
  textPrimary: '#2A2826',
  textSecondary: '#6B6661',
  textTertiary: '#A39E98',
  textOnPrimary: '#FFFFFF',

  // Status - Softer, more harmonious
  success: '#52B788',
  error: '#E76F51',
  warning: '#F4A261',
  info: '#4A90E2',

  // Borders & Dividers - Subtler
  border: '#EAE6E1',
  divider: '#F2EFE9',
  borderLight: '#F5F2ED',

  // Overlay
  overlay: 'rgba(42, 40, 38, 0.5)',
  overlayLight: 'rgba(42, 40, 38, 0.25)',
};

// Material Design 3 Elevation
export const Elevation = {
  level0: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  level4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  level5: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};

// Spacing (Material Design 3)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Compact variants for denser layouts
  compact: {
    xs: 3,
    sm: 6,
    md: 12,
    lg: 18,
  },
};

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Typography
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 24,
  },
  // Compact variant for card titles
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  caption: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  // Extra small for metadata
  tiny: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
};

// Legacy Colors (for backward compatibility)
const tintColorLight = WarmColors.primary;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: WarmColors.textPrimary,
    background: WarmColors.background,
    tint: tintColorLight,
    icon: WarmColors.textSecondary,
    tabIconDefault: WarmColors.textTertiary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
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
