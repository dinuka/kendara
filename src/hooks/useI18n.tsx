"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

type Messages = typeof en;

const messages: Record<string, Messages> = { en, si };

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "si",
  setLocale: () => {},
  t: () => "",
});

export function I18nProvider({ children, initialLocale = "si" }: { children: ReactNode; initialLocale?: string }) {
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback((l: string) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", l);
    }
  }, []);

  const t = useCallback(
    (path: string) => {
      const keys = path.split(".");
      let value: unknown = messages[locale] || messages.en;
      for (const key of keys) {
        value = (value as Record<string, unknown>)[key];
      }
      return (value as string) || path;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
