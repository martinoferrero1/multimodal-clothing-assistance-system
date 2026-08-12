"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

import type { Language, MessageKey, TranslationParams } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { readPreferences } from "@/lib/storage";

type LocaleContextValue = {
  language: Language;
  t: (key: MessageKey, params?: TranslationParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("preferences:changed", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("preferences:changed", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getLanguageSnapshot(): Language {
  return readPreferences().language;
}

function getServerLanguageSnapshot(): Language {
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.querySelectorAll('meta[name="description"]').forEach((element) => {
      element.setAttribute("content", translate(language, "metadata.description"));
    });
  }, [language]);

  return (
    <LocaleContext.Provider
      value={{
        language,
        t: (key, params) => translate(language, key, params),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return value;
}
