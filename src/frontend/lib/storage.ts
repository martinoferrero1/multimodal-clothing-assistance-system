import type { AuthSession, SettingsPreferences } from "@/lib/types";
import { isLanguage } from "@/lib/i18n";

const AUTH_KEY = "digital-atelier-session";
const PREFERENCES_KEY = "digital-atelier-preferences";

const defaultPreferences: SettingsPreferences = {
  compactSidebar: false,
  showRecommendationPanel: true,
  language: "en",
};

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_KEY);
}

export function readPreferences(): SettingsPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  const raw = window.localStorage.getItem(PREFERENCES_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    const stored = JSON.parse(raw) as Partial<SettingsPreferences>;
    return {
      ...defaultPreferences,
      ...stored,
      language: isLanguage(stored.language) ? stored.language : "en",
    };
  } catch {
    return defaultPreferences;
  }
}

export function writePreferences(preferences: SettingsPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
