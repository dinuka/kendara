"use client";

import { useI18n } from "@/hooks/useI18n";
import { useNavDrawer } from "@/hooks/useNavDrawer";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";

export function TopBar() {
    const { data: session } = useSession();
    const { t, locale, setLocale } = useI18n();
    const router = useRouter();
    const { open: navOpen, toggle: toggleNav } = useNavDrawer();
    const [searchQuery, setSearchQuery] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [menuOpen]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;
        // Guests can't use the search page; filter the public horoscope list instead.
        const target = session ? "/search" : "/horoscopes";
        router.push(`${target}?q=${encodeURIComponent(query)}`);
        setMobileSearchOpen(false);
    };

    useEffect(() => {
        if (!mobileSearchOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileSearchOpen(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [mobileSearchOpen]);

    const initial = session?.user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

    return (
        <header className="relative h-16 shrink-0 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

            <div className="h-full flex items-center gap-2 sm:gap-5 px-2 sm:px-6">
                <button
                    type="button"
                    onClick={toggleNav}
                    className="lg:hidden p-2 -ml-1 rounded-lg text-indigo-100 hover:bg-white/10 transition-colors"
                    aria-label={t("nav.menu")}
                    aria-controls="app-sidebar"
                    aria-expanded={navOpen}
                >
                    <svg
                        className="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        {navOpen ? (
                            <path d="M18 6 6 18M6 6l12 12" />
                        ) : (
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>

                <Link href="/" className="flex items-center gap-2 min-w-0 group">
                    <Image
                        src="/logo.png"
                        alt=""
                        width={36}
                        height={36}
                        priority
                        className="w-9 h-9 shrink-0 transition-transform group-hover:scale-105"
                    />
                    <span className="font-semibold text-base sm:text-lg text-white truncate leading-none tracking-tight">
                        {t("app.title")}
                    </span>
                </Link>

                <form onSubmit={handleSearch} className="relative flex-1 min-w-0 max-w-md hidden sm:block">
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300/70 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("nav.searchPlaceholder")}
                        aria-label={t("nav.searchPlaceholder")}
                        className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-indigo-200/60 outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50 focus:bg-white/15 transition-colors"
                    />
                </form>

                <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
                    <button
                        onClick={() => setMobileSearchOpen(true)}
                        aria-expanded={mobileSearchOpen}
                        aria-controls="mobile-search"
                        className="sm:hidden p-2 rounded-lg text-indigo-100 hover:bg-white/10 transition-colors"
                        aria-label={t("nav.search")}
                    >
                        <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </button>

                    <button
                        onClick={() => setLocale(locale === "si" ? "en" : "si")}
                        className="text-xs sm:text-sm px-2 sm:px-2.5 py-1.5 rounded-lg text-indigo-100 border border-white/15 hover:bg-white/10 hover:text-white transition-colors leading-none"
                    >
                        {locale === "si" ? "English" : "සිංහල"}
                    </button>

                    {session ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen((open) => !open)}
                                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/10 transition-colors"
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                            >
                                <span className="w-8 h-8 rounded-full bg-amber-400 text-indigo-950 flex items-center justify-center text-sm font-semibold leading-none">
                                    {initial}
                                </span>
                                <svg
                                    className={`w-3.5 h-3.5 text-indigo-200 transition-transform hidden sm:block ${menuOpen ? "rotate-180" : ""}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </button>

                            {menuOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 overflow-hidden"
                                >
                                    <div className="px-3.5 py-2 border-b border-gray-100">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {session.user?.name}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                                    </div>

                                    {session.user?.role === "super-admin" && (
                                        <Link
                                            href="/admin"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            role="menuitem"
                                        >
                                            {t("nav.admin")}
                                        </Link>
                                    )}

                                    <Link
                                        href="/settings"
                                        onClick={() => setMenuOpen(false)}
                                        className="block px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        role="menuitem"
                                    >
                                        {t("nav.settings")}
                                    </Link>

                                    <button
                                        onClick={() => signOut()}
                                        className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        role="menuitem"
                                    >
                                        {t("auth.signOut")}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Icon-only below `md` so the app name keeps its room; full label from `md` up.
                        <Link
                            href="/signin"
                            aria-label={t("auth.signIn")}
                            title={t("auth.signIn")}
                            className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 text-sm bg-amber-400 text-indigo-950 font-medium rounded-lg whitespace-nowrap hover:bg-amber-300 transition-colors leading-none"
                        >
                            <svg
                                className="w-5 h-5 md:hidden"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <path d="m10 17 5-5-5-5" />
                                <path d="M15 12H3" />
                            </svg>
                            <span className="hidden md:inline">{t("auth.signIn")}</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Phone search: covers the header row; submits through the same handleSearch as desktop. */}
            {mobileSearchOpen && (
                <form
                    id="mobile-search"
                    role="search"
                    onSubmit={handleSearch}
                    className="sm:hidden absolute inset-0 z-50 flex items-center gap-2 px-2 bg-indigo-950"
                >
                    <button
                        type="button"
                        onClick={() => setMobileSearchOpen(false)}
                        className="p-2 rounded-lg text-indigo-100 hover:bg-white/10 transition-colors shrink-0"
                        aria-label={t("common.cancel")}
                    >
                        <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="m12 19-7-7 7-7" />
                            <path d="M19 12H5" />
                        </svg>
                    </button>
                    <input
                        type="search"
                        enterKeyHint="search"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("nav.searchPlaceholder")}
                        aria-label={t("nav.searchPlaceholder")}
                        className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-base text-white placeholder:text-indigo-200/60 outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50"
                    />
                    <button
                        type="submit"
                        disabled={!searchQuery.trim()}
                        className="p-2 rounded-lg bg-amber-400 text-indigo-950 hover:bg-amber-300 disabled:opacity-50 transition-colors shrink-0"
                        aria-label={t("nav.search")}
                    >
                        <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </button>
                </form>
            )}
        </header>
    );
}
