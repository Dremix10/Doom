// Tiny local store. Web uses localStorage (the demo runs as a home-screen PWA);
// native falls back to in-memory values, which is enough for a hackathon build —
// with the caveat that a full reload on Expo Go signs you out and forgets your
// theme choice.
import { Platform } from 'react-native';

const TOKEN_KEY = 'doom_token';
const THEME_KEY = 'doom_theme';

let memToken: string | null = null;
let memTheme = 'system';

function read(key: string, fallback: string | null): string | null {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }
  return fallback;
}

function write(key: string, value: string | null): void {
  if (Platform.OS !== 'web') return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export function getToken(): string | null {
  return read(TOKEN_KEY, memToken);
}

export function setToken(token: string | null): void {
  memToken = token;
  write(TOKEN_KEY, token);
}

export type StoredThemeMode = 'light' | 'dark' | 'system';

export function getThemeMode(): StoredThemeMode {
  const v = read(THEME_KEY, memTheme);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function setThemeMode(mode: StoredThemeMode): void {
  memTheme = mode;
  write(THEME_KEY, mode);
}
