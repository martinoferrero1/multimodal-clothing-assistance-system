"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

import { getMe, login as loginRequest, register as registerRequest } from "@/lib/api-client";
import { clearSession, readSession, writeSession } from "@/lib/storage";
import type { AuthSession, User } from "@/lib/types";

type AuthContextValue = {
  status: "loading" | "authenticated" | "guest";
  token: string | null;
  tokenType: string | null;
  expiresAt: string | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    function deferStateUpdate(callback: () => void) {
      queueMicrotask(callback);
    }

    const stored = readSession();
    if (!stored) {
      deferStateUpdate(() => setStatus("guest"));
      return;
    }

    const expiresAt = new Date(stored.token.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      clearSession();
      deferStateUpdate(() => {
        setSession(null);
        setStatus("guest");
      });
      return;
    }

    const persistedSession = stored;

    deferStateUpdate(() => setSession(persistedSession));

    async function validateSession() {
      try {
        const user = await getMe(persistedSession.token.access_token);
        const nextSession = { ...persistedSession, user };
        writeSession(nextSession);
        setSession(nextSession);
        setStatus("authenticated");
      } catch {
        clearSession();
        setSession(null);
        setStatus("guest");
      }
    }

    void validateSession();
  }, []);

  async function signIn(email: string, password: string) {
    const response = await loginRequest(email, password);
    const nextSession: AuthSession = {
      token: response.token,
      user: response.user,
    };
    writeSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
  }

  async function signUp(displayName: string, email: string, password: string) {
    const response = await registerRequest(displayName, email, password);
    const nextSession: AuthSession = {
      token: response.token,
      user: response.user,
    };
    writeSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
  }

  function signOut() {
    clearSession();
    startTransition(() => {
      setSession(null);
      setStatus("guest");
    });
  }

  async function refreshUser() {
    if (!session) {
      return;
    }

    const user = await getMe(session.token.access_token);
    const nextSession = {
      ...session,
      user,
    };
    writeSession(nextSession);
    setSession(nextSession);
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        token: session?.token.access_token ?? null,
        tokenType: session?.token.token_type ?? null,
        expiresAt: session?.token.expires_at ?? null,
        user: session?.user ?? null,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
