import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as api from "./api";
import { transport, ApiError } from "./client";
import { translate, type Language, type MessageKey } from "./i18n";
import type { AuthResponse, CatalogProduct } from "./types";

type Preferences = {
  language: Language;
  compactChat: boolean;
  showRecommendations: boolean;
};
type State = {
  auth: AuthResponse | null;
  status: "loading" | "anonymous" | "authenticated" | "error";
  error: string | null;
  accept(value: AuthResponse): void;
  restore(): Promise<void>;
  signOut(all?: boolean): Promise<void>;
  preferences: Preferences;
  setPreferences(value: Partial<Preferences>): Promise<void>;
  favorites: CatalogProduct[];
  toggleFavorite(value: CatalogProduct): Promise<void>;
  l(es: string, en: string): string;
  t(key: MessageKey): string;
};
const Context = createContext<State | null>(null);
const defaults: Preferences = {
  language: "es",
  compactChat: false,
  showRecommendations: true,
};
export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [preferences, updatePreferences] = useState(defaults);
  const preferencesRef = useRef(defaults);
  const [favorites, updateFavorites] = useState<CatalogProduct[]>([]);
  const favoritesRef = useRef<CatalogProduct[]>([]);
  const storageQueue = useRef(Promise.resolve());
  const clear = useCallback(() => {
    setAuth(null);
    setStatus("anonymous");
  }, []);
  const accept = useCallback((value: AuthResponse) => {
    transport().setCsrf(value.csrf_token);
    setAuth(value);
    setStatus("authenticated");
    setError(null);
  }, []);
  const restore = useCallback(async () => {
    try {
      accept(await api.restoreSession());
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return;
      if (e instanceof ApiError && e.status === 401) clear();
      else {
        setError("connection");
        setStatus("error");
      }
    }
  }, [accept, clear]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        transport().onExpired = clear;
        void restore();
      } catch {
        setError("configuration");
        setStatus("error");
      }
    });
    void AsyncStorage.multiGet(["lookeate.preferences", "lookeate.favorites"])
      .then(([prefs, saved]) => {
        try {
          const value = JSON.parse(prefs[1] ?? "{}");
          const next: Preferences = {
            language: value.language === "en" ? "en" : "es",
            compactChat: value.compactChat === true,
            showRecommendations: value.showRecommendations !== false,
          };
          preferencesRef.current = next;
          updatePreferences(next);
          const products: unknown = JSON.parse(saved[1] ?? "[]");
          const valid = Array.isArray(products)
            ? products.filter(
                (p) =>
                  p &&
                  typeof p.id === "number" &&
                  typeof p.product_display_name === "string" &&
                  p.images &&
                  typeof p.images === "object",
              )
            : [];
          favoritesRef.current = valid;
          updateFavorites(valid);
        } catch {
          /* Corrupt non-sensitive preferences fall back to defaults. */
        }
      })
      .catch(() => setError("storage"));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void restore();
    });
    return () => subscription.remove();
  }, [clear, restore]);
  function mutateStorage(action: () => Promise<void>) {
    const write = storageQueue.current.catch(() => {}).then(action);
    storageQueue.current = write;
    return write;
  }
  function setPreferences(value: Partial<Preferences>) {
    return mutateStorage(async () => {
      const next = { ...preferencesRef.current, ...value };
      await AsyncStorage.setItem("lookeate.preferences", JSON.stringify(next));
      preferencesRef.current = next;
      updatePreferences(next);
    });
  }
  function toggleFavorite(value: CatalogProduct) {
    return mutateStorage(async () => {
      const next = favoritesRef.current.some((p) => p.id === value.id)
        ? favoritesRef.current.filter((p) => p.id !== value.id)
        : [value, ...favoritesRef.current];
      await AsyncStorage.setItem("lookeate.favorites", JSON.stringify(next));
      favoritesRef.current = next;
      updateFavorites(next);
    });
  }
  async function signOut(all = false) {
    await (all ? api.logoutAll() : api.logout());
    await transport().clear();
    clear();
  }
  return (
    <Context.Provider
      value={{
        auth,
        status,
        error,
        accept,
        restore,
        signOut,
        preferences,
        setPreferences,
        favorites,
        toggleFavorite,
        l: (es, en) => (preferences.language === "es" ? es : en),
        t: (key) => translate(preferences.language, key),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing AppProvider");
  return state;
}
