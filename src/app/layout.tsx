import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
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
            <body className="min-h-full flex flex-col bg-gray-50">
                <Providers>
                    <NextIntlClientProvider locale={locale} messages={messages}>
                        <Nav />
                        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">{children}</main>
                    </NextIntlClientProvider>
                </Providers>
            </body>
        </html>
    );
}
