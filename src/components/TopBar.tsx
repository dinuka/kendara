"use client";

import { useI18n } from "@/hooks/useI18n";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import Link from "next/link";

export function TopBar() {
    const { data: session } = useSession();
    const { t, locale, setLocale } = useI18n();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
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
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const initial = session?.user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

    return (
        <header className="relative h-16 shrink-0 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

            <div className="h-full flex items-center gap-5 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 shrink-0 group">
                    <span
                        className="w-8 h-8 rounded-full border border-amber-400/40 flex items-center justify-center text-amber-300 text-sm leading-none transition-colors group-hover:border-amber-400/80"
                        aria-hidden="true"
                    >
                        ✦
                    </span>
                    <span className="font-semibold text-lg text-white whitespace-nowrap leading-none tracking-tight">
                        {t("app.title")}
                    </span>
                </Link>

                <form onSubmit={handleSearch} className="relative flex-1 max-w-md hidden sm:block">
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

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={() => router.push("/search")}
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
                        className="text-sm px-2.5 py-1.5 rounded-lg text-indigo-100 border border-white/15 hover:bg-white/10 hover:text-white transition-colors leading-none"
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
                        <Link
                            href="/signin"
                            className="text-sm bg-amber-400 text-indigo-950 font-medium px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors leading-none"
                        >
                            {t("auth.signIn")}
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
