/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TS source; Next transpiles them (keeps the future RN port cheap).
  transpilePackages: ["@gm/core", "@gm/db", "@gm/shared", "@gm/config"],
};

export default nextConfig;
