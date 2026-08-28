"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT, getStoreStatus, login as loginRequest, logout as logoutRequest, register as registerRequest, registerStore as registerStoreRequest, restoreSession, setCsrfToken, verifyStoreEmail as verifyStoreEmailRequest } from "@/lib/api-client";
import { removeLegacySession } from "@/lib/storage";
import type { AuthResponse, SelectedStoreStatus, StoreRegistrationRequest, User } from "@/lib/types";

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  user: User | null;
  selectedStore: SelectedStoreStatus | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  registerStore: (payload: StoreRegistrationRequest) => Promise<void>;
  verifyStoreEmail: (verificationValue: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshStoreStatus: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [selectedStore, setSelectedStore] = useState<SelectedStoreStatus | null>(null);
  const clear = useCallback(() => { setCsrfToken(null); setUser(null); setSelectedStore(null); setStatus("anonymous"); }, []);
  const accept = useCallback((response: AuthResponse) => { setCsrfToken(response.csrf_token); setUser(response.user); setSelectedStore(response.selected_store ?? null); setStatus("authenticated"); }, []);

  useEffect(() => {
    removeLegacySession();
    void restoreSession().then(accept).catch(clear);
  }, [accept, clear]);
  useEffect(() => { window.addEventListener(AUTH_EXPIRED_EVENT, clear); return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clear); }, [clear]);

  async function signIn(email: string, password: string) { accept(await loginRequest(email, password)); }
  async function signUp(displayName: string, email: string, password: string) { accept(await registerRequest(displayName, email, password)); }
  async function registerStore(payload: StoreRegistrationRequest) { accept(await registerStoreRequest(payload)); }
  async function verifyStoreEmail(verificationValue: string) { accept(await verifyStoreEmailRequest(verificationValue)); }
  async function signOut() { try { await logoutRequest(); } finally { clear(); } }
  async function refreshUser() { accept(await restoreSession()); }
  async function refreshStoreStatus() { setSelectedStore((await getStoreStatus()).selected_store); }

  return <AuthContext.Provider value={{ status, user, selectedStore, signIn, signUp, registerStore, verifyStoreEmail, signOut, refreshUser, refreshStoreStatus }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
