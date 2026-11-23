import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withBotId } from "botid/next/config";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Camera via the file input; geolocation for the incident place. Nothing else.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Tokens live in the path; never let them be cached by shared caches.
      { source: "/(r|i|d)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withBotId(withNextIntl(nextConfig));
