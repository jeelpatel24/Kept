import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no CDN dependency; builds offline and on Vercel identically).
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kept", template: "%s — Kept" },
  description: "Record a conversation. Every commitment becomes a tracked task.",
  applicationName: "Kept",
  appleWebApp: { capable: true, title: "Kept", statusBarStyle: "default" },
  openGraph: {
    title: "Kept",
    description: "You said it. Now it's on the board. Conversations become shared, correctable notes — and every commitment becomes a tracked task.",
    type: "website",
    siteName: "Kept",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f2ed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div id="live-region" aria-live="polite" className="sr-only" />
        {children}
      </body>
    </html>
  );
}
