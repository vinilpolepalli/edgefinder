import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "EdgeFinder - Sports Betting Edge Finder",
  description: "Scrape live props, run statistical models, surface the highest-edge bets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          inter.variable,
          jetbrains.variable,
          "font-sans antialiased bg-[#0a0e17] text-white min-h-screen"
        )}
      >
        <TooltipProvider>
          <Navbar />
          <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            {children}
          </main>
          <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
            For entertainment purposes only. Past performance does not guarantee future results.
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
