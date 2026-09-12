// Auth context: holds the current user, exposes signup/login/logout, and a
// heartbeat so friends see you as "available" while the app is open.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, Me } from './api';
import { getToken, setToken } from './store';

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) { setMe(null); return; }
    try { setMe(await api.me()); } catch { setToken(null); setMe(null); }
  }, []);

  // Dev/demo convenience: ?token=XXX in the URL logs you straight in (web only),
  // so you can open a link per seeded user. The param is stripped after reading.
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          const t = params.get('token');
          if (t) setToken(t);
          // An invite link is ?invite=CODE. Stash it: we can only act on it once
          // we know who the current user is, which may be after a fresh signup.
          const invite = params.get('invite');
          if (invite) setPendingInvite(invite.toUpperCase());
          if (t || invite) {
            const url = new URL(window.location.href);
            url.searchParams.delete('token');
            url.searchParams.delete('invite');
            window.history.replaceState({}, '', url.toString());
          }
        }
      } catch { /* ignore */ }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Redeem an invite link as soon as there's someone to add them to.
  useEffect(() => {
    if (!me || !pendingInvite) return;
    api.addFriend(pendingInvite).catch(() => {}).finally(() => setPendingInvite(null));
  }, [me, pendingInvite]);

  // Heartbeat every 30s so availability-based friend selection works.
  useEffect(() => {
    if (!me) return;
    const id = setInterval(() => { api.heartbeat().catch(() => {}); }, 30000);
    api.heartbeat().catch(() => {});
    return () => clearInterval(id);
  }, [me]);

  const signup = async (name: string, email: string, password: string) => {
    const u = await api.signup(name, email, password);
    setToken(u.token); setMe(u);
  };
  const login = async (email: string, password: string) => {
    const u = await api.login(email, password);
    setToken(u.token); setMe(u);
  };
  const loginWithToken = async (token: string) => {
    setToken(token.trim());
    const u = await api.me(); setMe(u);
  };
  const logout = () => { setToken(null); setMe(null); };

  return (
    <Ctx.Provider value={{ me, loading, signup, login, loginWithToken, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}
