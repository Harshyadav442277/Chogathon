/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict Mode double-mounts every drei <Html> overlay in dev, which floods the console with
  // React 19 "synchronously unmount a root" errors. Production never double-mounts.
  reactStrictMode: false,
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: { "/api/**": ["./data/chogs.json", "./data/world.json"] },
};

export default nextConfig;
