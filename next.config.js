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
  // data/*.json and lib/schema.sql are read at runtime via path.join(process.cwd(), ...), which the
  // build's static tracer cannot see. Listed explicitly so they land in .next/standalone — without
  // login_whitelist.json in particular the app fails closed and nobody can sign in.
  // (Next 14 still keeps this under `experimental`; it moved to the top level in Next 15.)
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./data/*.json", "./lib/schema.sql"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
