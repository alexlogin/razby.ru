"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  localeCookieName,
  localeDateTags,
  normalizeLocale,
  t,
  type Locale,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  dateLocale: string;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dateLocale: localeDateTags[locale],
      setLocale(nextLocale) {
        const safeLocale = normalizeLocale(nextLocale);
        setLocaleState(safeLocale);
        window.localStorage.setItem(localeCookieName, safeLocale);
        document.cookie = `${localeCookieName}=${safeLocale}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
      },
      t(key, values) {
        return t(locale, key, values);
      },
    }),
    [locale, router],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
