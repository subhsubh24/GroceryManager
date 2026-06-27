/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TS source; Next transpiles them (keeps the future RN port cheap).
  transpilePackages: ["@gm/core", "@gm/db", "@gm/shared", "@gm/config"],
  // Our internal packages use explicit ".js" specifiers (NodeNext/Bundler style) that point at
  // ".ts" source — teach webpack to resolve them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  async headers() {
    return [
      {
        // Security headers on every route
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS — 1 year, include subdomains (enable only over HTTPS in production)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // CSP — permits Next.js hydration + Plausible analytics + TheMealDB + Open Food Facts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://plausible.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://plausible.io https://www.themealdb.com https://world.openfoodfacts.org",
              "media-src 'none'",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // CORS for mobile API routes — allow requests from the same origin and native mobile clients
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
