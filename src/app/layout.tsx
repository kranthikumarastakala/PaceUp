import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/ToastProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PaceUp — Track. Share. Improve.",
  description: "A better way to track your fitness activities",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PaceUp",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`} style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <ThemeProvider>
          <ToastProvider>
            <Navbar />
            <main className="pt-16">{children}</main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


