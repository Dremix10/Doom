// Tiny token store. Web uses localStorage (the demo runs as a home-screen PWA);
// native falls back to an in-memory value, which is enough for a hackathon build.
import { Platform } from 'react-native';

const KEY = 'nudge_token';
let mem: string | null = null;

export function getToken(): string | null {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(KEY); } catch { return mem; }
  }
  return mem;
}

export function setToken(token: string | null): void {
  mem = token;
  if (Platform.OS === 'web') {
    try {
      if (token) window.localStorage.setItem(KEY, token);
      else window.localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
}
