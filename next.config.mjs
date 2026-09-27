/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "1";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://*.phonepe.com\")",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://phonepe.com https://*.phonepe.com https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://phonepe.com https://*.phonepe.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co https://phonepe.com https://*.phonepe.com https://api.razorpay.com https://vitals.vercel-insights.com https://*.upstash.io",
      "frame-src 'self' https://phonepe.com https://*.phonepe.com https://api.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://phonepe.com https://*.phonepe.com",
    ].join("; "),
  },
];

const dynamicNoCacheHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
  {
    key: "Expires",
    value: "0",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export mode is used by the GitHub Pages deploy workflow
  // (.github/workflows/deploy-pages.yml). The Vercel/server build ignores it.
  ...(isExport ? { output: "export" } : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  ...(!isExport
    ? {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
            {
              source: "/admin/:path*",
              headers: dynamicNoCacheHeaders,
            },
            {
              source: "/api/admin/:path*",
              headers: dynamicNoCacheHeaders,
            },
            {
              source: "/api/orders/:path*",
              headers: dynamicNoCacheHeaders,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
