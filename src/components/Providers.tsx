"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/hooks/useI18n";
import { ReactNode } from "react";

export function Providers({ children, locale }: { children: ReactNode; locale?: string }) {
  return (
    <SessionProvider>
      <I18nProvider initialLocale={locale || "si"}>
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
