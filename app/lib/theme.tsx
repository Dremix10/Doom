// Shared visual language, in two palettes.
//
// Dark is the original, taken straight from the logo: warm near-black ground, the
// wordmark's cream for text, the clock wedge's orange as the accent. Light is the
// same logo read the other way round — the cream becomes the page and the near-
// black becomes the ink — but it is NOT an inversion: the state colours and the
// accent are re-derived, because bright-on-black hues wash out on paper.
//
// Only colours change between themes. Type, spacing, radii and hairlines are the
// same in both, so they stay plain module constants.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { getThemeMode, setThemeMode } from './store';

export const DARK = {
  bg: '#0c0b0b',
  card: '#171514',
  card2: '#201d1b',
  line: '#2e2a28',
  text: '#f7f3ea',      // the wordmark cream
  dim: '#a8a099',
  faint: '#6f6862',
  accent: '#ff5a2b',    // the clock wedge
  accentDim: '#7a3420',
  accentWash: 'rgba(255,90,43,0.13)',
  onAccent: '#140f0d',  // 5.7:1 on the accent, where white would be 3.1:1
  problemWash: 'rgba(255,59,92,0.10)',
  fine: '#3ecf8e',
  drifting: '#ffc53d',
  problem: '#ff3b5c',
  offline: '#5f5852',
  gold: '#d9a227',
  silver: '#c4c8d0',
  bronze: '#c77b4a',
  /** What the OS paints around the app: status bar, PWA chrome. */
  chrome: '#0c0b0b',
  barStyle: 'light' as 'light' | 'dark',
};

export const LIGHT: typeof DARK = {
  bg: '#f7f3ea',        // the wordmark cream, now the page
  card: '#ffffff',
  card2: '#f1ece1',
  line: '#e3ddd0',
  text: '#17140f',
  dim: '#6b6357',
  faint: '#9a9184',
  // A deeper burnt orange: #ff5a2b on cream is only 3.0:1, which fails for text.
  // This is 5.0:1 and still unmistakably the same hue.
  accent: '#c2350f',
  accentDim: '#e8b8a6',
  accentWash: 'rgba(194,53,15,0.10)',
  onAccent: '#ffffff',  // the light accent is dark enough to carry white
  problemWash: 'rgba(200,30,60,0.10)',
  // Darkened so they still read as green / amber / red on paper. The dark
  // theme's #3ecf8e and #ffc53d all but vanish on cream.
  fine: '#12855a',
  drifting: '#a2690a',
  problem: '#c81e3c',
  offline: '#9a9184',
  gold: '#c08c17',
  silver: '#a9afba',
  bronze: '#b8683a',
  chrome: '#f7f3ea',
  barStyle: 'dark',
};

export type Palette = typeof DARK;
export type ThemeMode = 'light' | 'dark' | 'system';

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; colors: Palette; resolved: 'light' | 'dark' };
const ThemeCtx = createContext<Ctx>({ mode: 'system', setMode: () => {}, colors: DARK, resolved: 'dark' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(getThemeMode());

  const resolved: 'light' | 'dark' = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const colors = resolved === 'light' ? LIGHT : DARK;

  const setMode = useCallback((m: ThemeMode) => { setModeState(m); setThemeMode(m); }, []);

  // The status-bar colour of an installed PWA comes from a <meta> tag, which
  // React never touches — so it has to be rewritten by hand when the theme flips,
  // or a light app keeps a black status bar.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors.chrome);
    document.documentElement.style.backgroundColor = colors.chrome;
    document.body.style.backgroundColor = colors.chrome;
    document.documentElement.style.colorScheme = resolved;
  }, [colors.chrome, resolved]);

  const value = useMemo(() => ({ mode, setMode, colors, resolved }), [mode, setMode, colors, resolved]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
export const useColors = () => useContext(ThemeCtx).colors;

/** Build a stylesheet from the active palette.
 *
 *  StyleSheet.create runs once at import, so a module-scope stylesheet freezes
 *  whichever colours were loaded first and never repaints. Screens declare a
 *  factory instead and call this, which rebuilds only when the palette changes. */
export function useStyles<T>(factory: (C: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}

export const stateColor = (C: Palette, s: string): string =>
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
