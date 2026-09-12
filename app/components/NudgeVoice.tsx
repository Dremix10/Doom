import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

// Speaks the most recent nudge out loud when Doom is opened or brought to the
// foreground. Web/PWA only. iOS won't play custom audio from a background push,
// so the ElevenLabs voice plays in-app the moment you open the app.
export default function NudgeVoice() {
  const { me } = useAuth();
  const lastPlayed = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !me || typeof window === 'undefined') return;

    const playLatest = async () => {
      try {
        const notes = await api.notifications(true); // unread only
        const nudge = notes.find((n) => !!n.audio_url);
        if (!nudge || !nudge.audio_url || lastPlayed.current === nudge.id) return;
        const audio = new Audio(api.base + nudge.audio_url);
        const done = () => {
          lastPlayed.current = nudge.id;
          api.markRead(nudge.id).catch(() => {});
        };
        try {
          await audio.play();
          done();
        } catch {
          // iOS blocks autoplay until a gesture: play on the next tap, once.
          const onTap = async () => {
            try { await audio.play(); done(); } catch { /* ignore */ }
            window.removeEventListener('pointerdown', onTap);
          };
          window.addEventListener('pointerdown', onTap, { once: true });
        }
      } catch { /* ignore transient */ }
    };

    playLatest();
    const onVisible = () => { if (document.visibilityState === 'visible') playLatest(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', playLatest);
    const poll = setInterval(playLatest, 15000); // also catch nudges that arrive while open
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', playLatest);
      clearInterval(poll);
    };
  }, [me]);

  return null;
}
