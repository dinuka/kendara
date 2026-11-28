"use client";

import { usePathname } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

interface NavDrawerState {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggle: () => void;
}

const NavDrawerContext = createContext<NavDrawerState | null>(null);

/** Open/closed state for the sidebar drawer used below the `lg` breakpoint. Closes on navigation
 *  and on Escape, and locks body scroll while open. */
export function NavDrawerProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const toggle = useCallback(() => setOpen((o) => !o), []);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    return <NavDrawerContext.Provider value={{ open, setOpen, toggle }}>{children}</NavDrawerContext.Provider>;
}

export function useNavDrawer(): NavDrawerState {
    const ctx = useContext(NavDrawerContext);
    if (!ctx) throw new Error("useNavDrawer must be used inside NavDrawerProvider");
    return ctx;
}
