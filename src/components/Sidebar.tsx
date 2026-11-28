"use client";

import { useI18n } from "@/hooks/useI18n";
import { useNavDrawer } from "@/hooks/useNavDrawer";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import Link from "next/link";

const sidebarItems = [
    { href: "/", key: "nav.dashboard", guest: true },
    { href: "/horoscopes", key: "nav.horoscopes", guest: true },
    { href: "/search", key: "nav.search", guest: false },
    { href: "/locations", key: "nav.locations", guest: false },
    { href: "/settings", key: "nav.settings", guest: false },
];

export function Sidebar() {
    const { status } = useSession();
    const pathname = usePathname();
    const { t } = useI18n();
    const { open, setOpen } = useNavDrawer();

    const isActive = (href: string) => {
        const [base] = href.split("?");
        if (base === "/") return pathname === "/";
        return pathname === base || pathname.startsWith(base + "/");
    };

    // Guests only get the public pages; nothing renders while the session is still loading.
    const visibleItems = sidebarItems.filter(
        (item) => status === "authenticated" || (status === "unauthenticated" && item.guest),
    );

    // Below `lg` the sidebar is an off-canvas drawer toggled from the TopBar; at `lg`+ it is static.
    return (
        <>
            <div
                className={`fixed inset-0 top-16 z-30 bg-gray-900/40 transition-opacity lg:hidden ${
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setOpen(false)}
                aria-hidden="true"
            />
            <aside
                id="app-sidebar"
                className={`fixed top-16 bottom-0 left-0 z-40 w-64 max-w-[80vw] bg-white border-r border-gray-200 flex flex-col py-6 overflow-y-auto transition-transform duration-200 ease-out lg:static lg:z-auto lg:max-w-none lg:h-full lg:shrink-0 lg:translate-x-0 ${
                    open ? "translate-x-0 shadow-xl lg:shadow-none" : "-translate-x-full"
                }`}
            >
                <nav className="flex flex-col gap-2 px-4">
                    {visibleItems.map(({ href, key }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={key}
                                href={href}
                                className={`flex items-center gap-4 px-5 py-3 lg:py-4 rounded-xl text-base font-medium transition-colors ${
                                    active
                                        ? "text-indigo-700 bg-indigo-50"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                }`}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                                        active ? "bg-indigo-600" : "bg-gray-300"
                                    }`}
                                />
                                {t(key)}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
