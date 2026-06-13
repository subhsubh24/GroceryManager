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
};

export default nextConfig;
