import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { getI18n } from "@/i18n/server";
import { getSettings } from "@/lib/auth";
import { LangProvider } from "@/i18n/client";
import "./globals.css";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ar",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: s.platformName,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e3a8a" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await getI18n();
  return (
    <html lang={lang} dir={dir} className={font.variable}>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
