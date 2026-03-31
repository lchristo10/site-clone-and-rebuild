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
  title: "ALIAS COMPILER — Website Clone & AEO Rebuilder",
  description: "Clone any website and rebuild it with AEO (Answer Engine Optimization) — structured for AI visibility on Perplexity, ChatGPT, and Google AI Overviews.",
  keywords: ["AEO", "Answer Engine Optimization", "website cloner", "AI SEO", "structured data"],
  authors: [{ name: "ALIAS" }],
  openGraph: {
    title: "ALIAS COMPILER",
    description: "Clone and AEO-optimize any website in minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
