import { HelpChat } from "@/components/HelpChat";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

import { siteUrl } from "@/lib/seo";

import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl()),
    title: {
        default: "Kendara - ජ්‍යෝතිෂ්‍ය අධ්‍යයන වේදිකාව",
        template: "%s | Kendara",
    },
    description:
        "කේන්දර අධ්‍යයන වේදිකාව — ප්‍රසිද්ධ පුද්ගලයන්ගේ කේන්දර, උපන් වේලාව, උපන් ස්ථානය, යෝග සහ දශා. Vedic astrology horoscopes (kendara) with birth charts, navamsa, yogas and dashas.",
    applicationName: "Kendara",
    openGraph: { siteName: "Kendara", locale: "si_LK", type: "website" },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="h-full flex flex-col bg-gray-50">
                <Providers>
                    <NextIntlClientProvider locale={locale} messages={messages}>
                        <TopBar />
                        <div className="flex flex-1 overflow-hidden">
                            <Sidebar />
                            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
                                {children}
                            </main>
                        </div>
                    </NextIntlClientProvider>
                    <HelpChat />
                </Providers>
            </body>
        </html>
    );
}
