/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: { "/api/**": ["./data/chogs.json"] },
};

export default nextConfig;
