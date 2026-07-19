import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

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
    title: "Kendara - ජ්‍යෝතිෂ්‍ය අධ්‍යයන වේදිකාව",
    description: "Astrology study platform for students",
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
                            <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
                        </div>
                    </NextIntlClientProvider>
                </Providers>
            </body>
        </html>
    );
}
