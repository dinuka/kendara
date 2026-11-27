"use client";

import { NavDrawerProvider } from "@/hooks/useNavDrawer";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <NavDrawerProvider>{children}</NavDrawerProvider>
        </SessionProvider>
    );
}
