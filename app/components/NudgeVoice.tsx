import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

// Speaks the most recent nudge (ElevenLabs audio) when Doom is opened or foregrounded.
//
// iOS will not let a page start audio on its own, and that restriction is per
// <audio> ELEMENT, not per page: an element that has played once during a real
// user gesture stays playable for the rest of the session. So we keep ONE element
// alive, unlock it with a silent clip on the first tap anywhere in the app, and
// reuse it for every nudge after that. Without this the voice is simply silent on
// a phone, which is how it looked "broken" while the server was generating audio
// perfectly well.
//
// Also guards the two ways this went wrong before:
//   1) many triggers fire at once on open -> a single-flight lock (busy).
//   2) a backlog plays on top of itself -> only ever play the newest one.
const SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
const FRESH_MS = 10 * 60_000;  // don't speak a nudge older than this
const POLL_MS = 15_000;

export default function NudgeVoice() {
  const { me } = useAuth();
  const elRef = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const pending = useRef<{ url: string; id: string } | null>(null);
  const lastPlayed = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const el = new window.Audio();
    el.preload = 'auto';
    elRef.current = el;

    const start = (url: string, id: string) => {
      const audio = elRef.current;
      if (!audio) return;
      busy.current = true;
      audio.src = url;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          // Only now is it genuinely heard, so only now is it "read".
          lastPlayed.current = id;
          api.markRead(id).catch(() => {});
          pending.current = null;
        })
        .catch(() => {
          // Blocked: hold it for the next tap instead of losing it.
          busy.current = false;
          pending.current = { url, id };
        });
    };

    const release = () => { busy.current = false; };
    el.onended = release;
    el.onerror = release;

    const unlock = () => {
      const audio = elRef.current;
      if (!audio) return;
      if (!unlocked.current) {
        audio.src = SILENCE;
        audio
          .play()
          .then(() => {
            unlocked.current = true;
            audio.pause();
            audio.currentTime = 0;
            const held = pending.current;
            if (held) start(held.url, held.id);
          })
          .catch(() => {});
        return;
      }
      const held = pending.current;
      if (held && !busy.current) start(held.url, held.id);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);

    let timer: ReturnType<typeof setInterval> | null = null;
    let onVisible: (() => void) | null = null;

    if (me) {
      const check = async () => {
        if (busy.current) return;
        try {
          const notes = await api.notifications(true); // unread, newest first
          const audios = notes.filter((n) => !!n.audio_url);
          const fresh = audios.filter((n) => Date.now() - new Date(n.created_at).getTime() <= FRESH_MS);
          // Anything too old to say out loud gets cleared so it can't pile up.
          for (const n of audios) if (!fresh.includes(n)) api.markRead(n.id).catch(() => {});
          const latest = fresh[0];
          if (!latest || !latest.audio_url || latest.id === lastPlayed.current) return;
          for (const n of fresh.slice(1)) api.markRead(n.id).catch(() => {}); // newest only
          start(api.base + latest.audio_url, latest.id);
        } catch {
          busy.current = false;
        }
      };
      onVisible = () => { if (document.visibilityState === 'visible') check(); };
      check();
      document.addEventListener('visibilitychange', onVisible);
      timer = setInterval(check, POLL_MS);
    }

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
    };
  }, [me]);

  return null;
}
