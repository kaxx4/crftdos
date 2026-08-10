import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

// NOTE ON FONTS: the design reference (.dc.html prototype) specifies "Eina", a
// PAID Fontspring-licensed font (see _import/.../uploads/eina/License.txt —
// Fontspring Desktop/Webfont EULA, seat/traffic-limited, not a free
// redistributable). We have no proof of a purchased license covering this
// app's deployment, so we do NOT ship those .ttf files. Plus Jakarta Sans is
// a free (OFL) geometric grotesk with very similar proportions/weights and
// is used as the production substitute everywhere the design calls for Eina.
const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "crftd Stall OS",
  description: "AQUATERRA / crftd point-of-sale, kiosk and operations app",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "crftd" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

// Blue matches the POS header band so the browser chrome continues it rather
// than cutting across it. `viewportFit: cover` lets the kiosk run edge-to-edge.
export const viewport: Viewport = {
  themeColor: "#1B4DF5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-body">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
