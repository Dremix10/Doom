// Web Push client. Works on installed PWAs (iOS 16.4+, Android, desktop) with no
// Apple developer account. Requires HTTPS (or localhost) — service workers won't
// run otherwise. Everything is guarded so native/unsupported just no-ops.
import { api } from './api';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS only allows push from an app added to the Home Screen (standalone display).
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore - navigator.standalone is iOS-only
  const iosStandalone = typeof navigator !== 'undefined' && (navigator as any).standalone === true;
  const mq = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(iosStandalone || mq);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as Mac; distinguish by touch points.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function permissionState(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnableResult = { ok: boolean; reason?: string };

export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, reason: 'This device does not support web push.' };
  }
  // Only iOS requires the app to be installed to the Home Screen first.
  if (isIOS() && !isStandalone()) {
    return { ok: false, reason: 'On iPhone, first add Doom to your Home Screen (Share → Add to Home Screen), open it from there, then turn on notifications.' };
  }
  let cfg: { vapid_public_key: string; enabled: boolean };
  try { cfg = await api.pushConfig(); } catch { return { ok: false, reason: 'Could not reach the server.' }; }
  if (!cfg.enabled || !cfg.vapid_public_key) {
    return { ok: false, reason: 'Notifications are not configured on the server yet.' };
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'Notification permission was declined.' };
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.vapid_public_key),
    }));
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
    if (!j.endpoint || !j.keys) return { ok: false, reason: 'Subscription failed.' };
    await api.pushSubscribe(j.endpoint, j.keys.p256dh, j.keys.auth);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Could not subscribe to notifications.' };
  }
}
