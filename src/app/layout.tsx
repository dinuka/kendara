import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { cookies } from "next/headers";

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
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value || "si";

  return (
    <html lang={locale === "si" ? "si" : "en"} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <Providers locale={locale}>
          <Nav />
          <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
