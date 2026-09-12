// Shared visual language. Dark, calm, one accent. Used across every screen.
//
// The type scale, spacing and radii follow Apple's HIG so the PWA reads as a
// native iOS app rather than a website in a phone frame. Sizes are the real
// Apple text styles (largeTitle 34/41, body 17/22, ...) — don't invent new ones.
import { Platform, StyleSheet } from 'react-native';

export const C = {
  bg: '#0b0b0f',
  card: '#16161c',
  card2: '#1e1e26',
  line: '#2a2a34',
  text: '#f4f4f7',
  dim: '#a0a0ad',
  faint: '#6b6b78',
  accent: '#7c7bff',
  accentDim: '#3a3a6a',
  fine: '#3ecf8e',
  drifting: '#f5a623',
  problem: '#ff5c6c',
  offline: '#5a5a66',
};

export const stateColor = (s: string): string =>
  ({ fine: C.fine, drifting: C.drifting, problem: C.problem, offline: C.offline } as Record<string, string>)[s] || C.offline;

export const stateWord = (s: string): string =>
  ({ fine: 'doing fine', drifting: 'drifting', problem: 'doomscrolling', offline: 'offline' } as Record<string, string>)[s] || s;

// San Francisco on device; the same stack the system uses in Safari on web.
export const FONT = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: 'System',
}) as string;

// Apple's text styles. Spread these into a style: { ...T.body, color: C.text }.
export const T = {
  largeTitle: { fontFamily: FONT, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontFamily: FONT, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontFamily: FONT, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontFamily: FONT, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontFamily: FONT, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontFamily: FONT, fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontFamily: FONT, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontFamily: FONT, fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontFamily: FONT, fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontFamily: FONT, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontFamily: FONT, fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
  // Tab bar labels are their own thing in the HIG.
  tabLabel: { fontFamily: FONT, fontSize: 10, lineHeight: 12, fontWeight: '500', letterSpacing: 0 },
} as const;

// 8pt grid. `gutter` is the standard iOS screen margin.
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, gutter: 20 };

// iOS corner radii. `borderCurve: 'continuous'` gives the squircle on iOS and is
// ignored elsewhere.
export const R = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const CONTINUOUS = { borderCurve: 'continuous' } as const;

// A real hairline, not a 1px line.
export const HAIRLINE = StyleSheet.hairlineWidth;

// Standard iOS chrome heights (add the safe-area inset to these, never replace).
export const TAB_BAR_HEIGHT = 49;
export const MIN_TAP = 44;
