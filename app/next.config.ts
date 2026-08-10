import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /kiosk moved to the site root (/) — kept as a redirect for any saved
  // bookmarks, QR codes or links printed before the move.
  async redirects() {
    return [{ source: "/kiosk", destination: "/", permanent: true }];
  },
};

export default nextConfig;
