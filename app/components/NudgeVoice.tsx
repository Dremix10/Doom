import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

// Speaks the single most-recent nudge when Doom is opened or foregrounded.
// Web/PWA only. iOS won't play custom audio from a background push, so the
// ElevenLabs voice plays in-app.
//
// Guards against the two ways this went wrong before:
//   1) many triggers fire at once on open -> a single-flight lock (busy).
//   2) a backlog of old nudges plays on top of each other -> we mark the whole
//      backlog read and only ever play the newest, and only if it's fresh.
const FRESH_MS = 90_000; // don't speak a nudge older than this on open

export default function NudgeVoice() {
  const { me } = useAuth();
  const lastPlayed = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !me || typeof window === 'undefined') return;

    const playLatest = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const notes = await api.notifications(true); // unread, newest first
        const audios = notes.filter((n) => !!n.audio_url);
        // Clear the entire audio backlog so nothing piles up or replays later.
        for (const n of audios) api.markRead(n.id).catch(() => {});
        const latest = audios[0];
        if (!latest || !latest.audio_url || latest.id === lastPlayed.current) {
          busy.current = false;
          return;
        }
        const ageMs = Date.now() - new Date(latest.created_at).getTime();
        if (ageMs > FRESH_MS) { busy.current = false; return; } // stale — don't speak old nudges
        lastPlayed.current = latest.id;
        const audio = new Audio(api.base + latest.audio_url);
        const release = () => { busy.current = false; };
        audio.onended = release;
        audio.onerror = release;
        try {
          await audio.play();
        } catch {
          busy.current = false; // not stuck; play on the next tap
          const onTap = () => { audio.play().catch(() => {}); window.removeEventListener('pointerdown', onTap); };
          window.addEventListener('pointerdown', onTap, { once: true });
        }
      } catch {
        busy.current = false;
      }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') playLatest(); };
    playLatest();
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(playLatest, 15000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [me]);

  return null;
}
