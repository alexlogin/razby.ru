"use client";

import { Globe2 } from "lucide-react";
import { localeLabels, locales, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`language-switcher ${compact ? "compact" : ""}`} title={t("common.language")}>
      <Globe2 size={15} />
      <span>{compact ? locale.toUpperCase() : t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {localeLabels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
