"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

interface TawkApi {
    disableMobileBackHistory?: boolean;
    onLoad?: () => void;
    setAttributes?: (attributes: Record<string, string>, callback?: (error?: unknown) => void) => void;
    hideWidget?: () => void;
    showWidget?: () => void;
}

declare global {
    interface Window {
        Tawk_API?: TawkApi;
        Tawk_LoadStart?: Date;
    }
}

const PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID;

/** Routes where the help chat should not appear (public share views). */
const HIDDEN_PATH_PREFIXES = ["/share/"];

const isHiddenPath = (pathname: string) => HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

let tawkReady = false;
let pending: Array<(api: TawkApi) => void> = [];

// Tawk reads window.Tawk_API (including onLoad) when its embed script runs,
// so it must exist before the script loads.
if (typeof window !== "undefined" && !window.Tawk_API) {
    window.Tawk_API = {
        // On mobile, Tawk pushes a `#max-widget` history entry with its own
        // state when the chat opens. Popping it crashes the Next.js App Router
        // ("can't access property rsc"), which expects its tree in history.state.
        disableMobileBackHistory: true,
        onLoad: () => {
            tawkReady = true;
            const api = window.Tawk_API!;
            pending.forEach((fn) => fn(api));
            pending = [];
        },
    };
    window.Tawk_LoadStart = new Date();
}

/** Runs `fn` now if the Tawk widget has loaded, otherwise once it does. */
const whenTawkReady = (fn: (api: TawkApi) => void) => {
    if (tawkReady && window.Tawk_API) fn(window.Tawk_API);
    else pending.push(fn);
};

export function HelpChat() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const hidden = isHiddenPath(pathname);

    // Toggle visibility on route changes (and on initial load).
    useEffect(() => {
        whenTawkReady((api) => (hidden ? api.hideWidget?.() : api.showWidget?.()));
    }, [hidden]);

    // Identify signed-in users so chats aren't anonymous.
    const name = session?.user?.name ?? "";
    const email = session?.user?.email ?? "";
    useEffect(() => {
        if (!name && !email) return;
        whenTawkReady((api) => api.setAttributes?.({ name, email }));
    }, [name, email]);

    if (!PROPERTY_ID || !WIDGET_ID) return null;

    return (
        <Script
            id="tawk-embed"
            src={`https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`}
            strategy="lazyOnload"
            crossOrigin="anonymous"
        />
    );
}
