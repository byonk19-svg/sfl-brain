import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { Navigation } from "@/components/navigation";

import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "SFL Brain", template: "%s · SFL Brain" },
  description: "Private content memory and deterministic posting recommendations for Styled For Less.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${display.variable} ${sans.variable}`}>
        <Navigation />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
