import type { Metadata } from "next";
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
