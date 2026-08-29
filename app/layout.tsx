import "./globals.css";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Navbar from "@/components/Navbar";
import MobileFooterNav from "@/components/MobileFooterNav";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", 
});

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Ambient Medical Scribe",
  description: "Professional Ambient Clinical Intelligence Platform",
  keywords: "medical, AI, clinical documentation, ambient scribe, healthcare",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-[100dvh] overflow-hidden`} suppressHydrationWarning>
      <body className="antialiased h-[100dvh] max-h-[100dvh] flex flex-col bg-background font-sans text-foreground overflow-hidden" suppressHydrationWarning>
        <ToastProvider>
          <Navbar />
          <main className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden pt-16 sm:pt-20 pb-20 md:pb-3 w-full animate-fade-in-up custom-scrollbar">
            {children}
          </main>
          <MobileFooterNav />
        </ToastProvider>
      </body>
    </html>
  );
}