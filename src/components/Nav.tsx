"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/hooks/useI18n";

export function Nav() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg text-indigo-700">
            {t("app.title")}
          </Link>
          {session && (
            <div className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-indigo-600 transition-colors">
                {t("nav.dashboard")}
              </Link>
              <Link href="/horoscopes/new" className="hover:text-indigo-600 transition-colors">
                {t("nav.addHoroscope")}
              </Link>
              <Link href="/search" className="hover:text-indigo-600 transition-colors">
                {t("nav.search")}
              </Link>
              <Link href="/settings" className="hover:text-indigo-600 transition-colors">
                {t("nav.settings")}
              </Link>
              {session.user?.role === "super-admin" && (
                <Link href="/admin" className="hover:text-indigo-600 transition-colors text-amber-700">
                  {t("nav.admin")}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocale(locale === "si" ? "en" : "si")}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-100 transition-colors"
          >
            {locale === "si" ? "English" : "සිංහල"}
          </button>

          {session ? (
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              {t("auth.signOut")}
            </button>
          ) : (
            <Link
              href="/signin"
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors"
            >
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
