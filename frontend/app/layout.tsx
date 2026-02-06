import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Bird-Safe Flight Path Predictor",
  description: "Premium aviation platform for bird-risk-aware route planning and flight safety.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
