import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

/** Fonts are self-hosted through next/font, so a stall on mobile data is
 *  immune to a third-party font CDN outage.
 *
 *  The design reference specifies Eina, a paid Fontspring face. The .ttf files
 *  exist in the repo but are NOT shipped, because there is no evidence of a
 *  licence covering this deployment. Plus Jakarta Sans is the OFL substitute
 *  with similar geometric-grotesk proportions. This reasoning is recorded here
 *  rather than in a ticket because here is where the next person will look. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-face",
  display: "swap",
});

/** Fraunces is OFL. It is deliberately declared here but only *applied* inside
 *  the kiosk subtree, so the restrained volunteer surface cannot inherit a
 *  display serif it has no business wearing. */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["900"],
  style: ["italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "crftd Stall OS",
  description: "Point of sale, design kiosk and operations for crftd — the commercial arm of AQUATERRA / TerraRoots.",
  applicationName: "crftd Stall OS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // A POS that zooms when a volunteer double-taps a total is a POS that loses
  // its own layout mid-queue. Text still scales via the browser's own setting.
  maximumScale: 1,
  themeColor: "#0f0f10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
