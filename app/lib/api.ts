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
  persona_verified: boolean; setup_url: string; doh_url: string; shortcuts_url: string;
};
export type FriendState = {
  id: string; name: string; state: string; service: string | null;
  minutes: number; ratio: number; last_seen_min: number | null;
};
export type Group = {
  id: string; name: string; join_code: string; member_count: number;
  members: string[]; is_owner: boolean;
};
export type LeaderboardRow = {
  id: string; name: string; rank: number; minutes: number; ratio: number;
  state: string; top_service: string | null; is_me: boolean;
};
export type LeaderboardCategory = {
  id: string; label: string; blurb: string; lower_is_better: boolean;
};
export type Leaderboard = {
  group_id: string | null; groups: Group[];
  category: string; window: string; lower_is_better: boolean;
  categories: LeaderboardCategory[]; windows: string[]; rows: LeaderboardRow[];
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
  groups: () => req<Group[]>('/groups'),
  createGroup: (name: string) =>
    req<Group>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  joinGroup: (join_code: string) =>
    req<Group>('/groups/join', { method: 'POST', body: JSON.stringify({ join_code }) }),
  leaveGroup: (id: string) => req<any>(`/groups/${id}/leave`, { method: 'POST' }),
  leaderboard: (groupId: string | null, category: string, window: string) =>
    req<Leaderboard>(
      `/leaderboard?category=${category}&window=${window}` + (groupId ? `&group_id=${groupId}` : '')
    ),
  notifications: (unread = false) => req<Note[]>(`/notifications?unread=${unread}`),
  markRead: (id: string) => req<any>(`/notifications/${id}/read`, { method: 'POST' }),
  timeline: () => req<Decision[]>('/me/timeline'),
  heartbeat: () => req<any>('/heartbeat', { method: 'POST' }),
};
