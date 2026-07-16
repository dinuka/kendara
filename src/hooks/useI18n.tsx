"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useI18n() {
    const t = useTranslations();
    const locale = useLocale();
    const router = useRouter();

    const setLocale = useCallback(
        (newLocale: string) => {
            document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
            localStorage.setItem("locale", newLocale);
            router.refresh();
        },
        [router],
    );

    return { t, locale, setLocale };
}
