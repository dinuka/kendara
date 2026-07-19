"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import Link from "next/link";

const sidebarItems = [
    { href: "/", key: "nav.dashboard" },
    { href: "/horoscopes", key: "nav.horoscopes" },
    { href: "/search", key: "nav.search" },
    { href: "/locations", key: "nav.locations" },
    { href: "/settings", key: "nav.settings" },
];

export function Sidebar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const { t } = useI18n();

    const isActive = (href: string) => {
        const [base] = href.split("?");
        if (base === "/") return pathname === "/";
        return pathname === base || pathname.startsWith(base + "/");
    };

    return (
        <aside className="flex w-64 bg-white border-r border-gray-200 flex-col py-6 shrink-0 overflow-y-auto h-full">
            <nav className="flex flex-col gap-2 px-4">
                {sidebarItems.map(({ href, key }) => {
                    const active = isActive(href);
                    return (
                        <Link
                            key={key}
                            href={href}
                            className={`flex items-center gap-4 px-5 py-4 rounded-xl text-base font-medium transition-colors ${
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
                            {session && t(key)}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
