import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The kiosk canvas ships a lot of image weight; keep the router cache warm
    // between the storefront and the canvas so going "back" to browse is instant.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
