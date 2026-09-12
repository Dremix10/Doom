// Thin API client. Base URL comes from EXPO_PUBLIC_API_URL (Expo inlines EXPO_PUBLIC_*).
import { getToken } from './store';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function req<T>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) };
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type Me = {
  id: string; name: string; client_id: string; invite_code: string; token: string;
  persona_verified: boolean; setup_url: string; doh_url: string;
};
export type FriendState = {
  id: string; name: string; state: string; service: string | null;
  minutes: number; ratio: number; last_seen_min: number | null;
};
export type Note = {
  id: string; kind: string; title: string; body: string; audio_url: string | null;
  payload: Record<string, any>; created_at: string; read_at: string | null;
};
export type Decision = {
  id: string; action: string; justification: string; service: string | null;
  source: string; created_at: string;
};

export const api = {
  base: API_BASE,
  health: () => req<any>('/health', {}, false),
  signup: (name: string, phone?: string) =>
    req<Me>('/signup', { method: 'POST', body: JSON.stringify({ name, phone }) }, false),
  me: () => req<Me>('/me'),
  personaVerify: () => req<Me>('/persona/verify', { method: 'POST' }),
  myStatus: () => req<FriendState>('/me/status'),
  friends: () => req<FriendState[]>('/friends'),
  addFriend: (invite_code: string) =>
    req<FriendState>('/friends/add', { method: 'POST', body: JSON.stringify({ invite_code }) }),
  pullOut: (target_id: string, message?: string) =>
    req<Note>('/friends/pull-out', { method: 'POST', body: JSON.stringify({ target_id, message }) }),
  notifications: (unread = false) => req<Note[]>(`/notifications?unread=${unread}`),
  markRead: (id: string) => req<any>(`/notifications/${id}/read`, { method: 'POST' }),
  timeline: () => req<Decision[]>('/me/timeline'),
  heartbeat: () => req<any>('/heartbeat', { method: 'POST' }),
};
