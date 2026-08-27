// PWA manifest: install Kept to the home screen like an app — one tap from pocket to RECORD.
// Implements: UX-BRIEF §1 (mobile-first), TRD-4.2.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kept",
    short_name: "Kept",
    description: "Record a conversation. Every commitment becomes a tracked task.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ed",
    theme_color: "#f4f2ed",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
