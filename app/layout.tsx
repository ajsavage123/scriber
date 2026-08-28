import "./globals.css";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Navbar from "@/components/Navbar";
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
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased min-h-screen bg-background font-sans text-foreground">
        <ToastProvider>
          <Navbar />
          <main className="pt-24 pb-12 animate-fade-in-up">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}