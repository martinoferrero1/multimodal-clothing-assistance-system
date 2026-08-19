"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT, login as loginRequest, logout as logoutRequest, register as registerRequest, restoreSession, setCsrfToken } from "@/lib/api-client";
import { removeLegacySession } from "@/lib/storage";
import type { User } from "@/lib/types";

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);
  const clear = useCallback(() => { setCsrfToken(null); setUser(null); setStatus("anonymous"); }, []);
  const accept = useCallback((response: { user: User; csrf_token: string }) => { setCsrfToken(response.csrf_token); setUser(response.user); setStatus("authenticated"); }, []);

  useEffect(() => {
    removeLegacySession();
    void restoreSession().then(accept).catch(clear);
  }, [accept, clear]);
  useEffect(() => { window.addEventListener(AUTH_EXPIRED_EVENT, clear); return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clear); }, [clear]);

  async function signIn(email: string, password: string) { accept(await loginRequest(email, password)); }
  async function signUp(displayName: string, email: string, password: string) { accept(await registerRequest(displayName, email, password)); }
  async function signOut() { try { await logoutRequest(); } finally { clear(); } }
  async function refreshUser() { accept(await restoreSession()); }

  return <AuthContext.Provider value={{ status, user, signIn, signUp, signOut, refreshUser }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
