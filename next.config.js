// Baseline security headers on every response — no external scripts/fonts are loaded (next/font
// self-hosts at build time, Google OAuth is a top-level redirect not a same-page embed), so
// default-src 'self' covers the app; 'unsafe-inline' stays for script/style because Next.js
// injects inline hydration payloads and this app uses inline style={{}} for seat-grid layout
// (no nonce middleware set up — revisit if that's ever added).
// 'unsafe-eval' is dev-only: Next.js's Fast Refresh/HMR runtime uses eval() for hot-reloading,
// which a production build never does — omitting it in prod keeps the stricter policy there.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
