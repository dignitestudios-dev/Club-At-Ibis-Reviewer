import type { Metadata, Viewport } from "next";
import { Raleway, Playfair_Display } from "next/font/google";
import Providers from "@/providers";
import "./globals.css";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-heading-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Club At Ibis · ARB Reviewer",
  description: "Reviewer portal for the Club At Ibis Architectural Review Board.",
  icons: {
    icon: [
      { url: "/brand/club-at-ibis-logo.png", type: "image/png" },
      { url: "/brand/ibis-mark-navy.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/brand/club-at-ibis-logo.png",
    apple: "/brand/club-at-ibis-logo.png",
  },
};

// viewportFit "cover" lets the layout paint under the notch / home indicator (the safe-area utilities in
// globals.css then pad the fixed bars); "resizes-content" makes the on-screen keyboard shrink the layout so
// sheets and sticky bars ride above it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#112636" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1522" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${raleway.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
