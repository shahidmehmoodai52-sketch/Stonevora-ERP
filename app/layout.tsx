import type { Metadata } from "next";
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
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: "Stonevora — ERP for Marble, Granite, Stone & Tile Businesses",
    template: "%s — Stonevora",
  },
  description:
    "Stonevora is a multi-tenant ERP for marble, granite, natural stone and tile businesses — from trading and showrooms to factory production, fabrication and tile manufacturing.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Stonevora — ERP for Marble, Granite, Stone & Tile Businesses",
    description:
      "A multi-tenant ERP for marble, granite, natural stone and tile businesses — trading, factory production, fabrication, tile manufacturing, distribution and showrooms on one platform.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stonevora — ERP for Marble, Granite, Stone & Tile Businesses",
    description:
      "A multi-tenant ERP for marble, granite, natural stone and tile businesses.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
