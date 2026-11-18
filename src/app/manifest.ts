import type { MetadataRoute } from "next";

// Makes the reviewer portal installable ("Install app" / "Add to Home Screen") and launch full-screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Club At Ibis — ARB Reviewer",
    short_name: "ARB Reviewer",
    description: "Reviewer portal for the Club At Ibis Architectural Review Board.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d1522",
    theme_color: "#112636",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Assigned to me", short_name: "Assigned", url: "/my-requests", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Notifications", short_name: "Alerts", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
