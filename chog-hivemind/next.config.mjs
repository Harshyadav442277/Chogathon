/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict Mode double-mounts every drei <Html> overlay in dev, which floods the console with
  // React 19 "synchronously unmount a root" errors. Production never double-mounts.
  reactStrictMode: false,
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: { "/api/**": ["./data/chogs.json", "./data/world.json"] },
  // The Godot web build is exported into public/play/ (single-threaded: no COOP/COEP headers needed).
  // Redirect (not rewrite) so the export's relative asset URLs (index.js, index.wasm, index.pck) resolve under /play/.
  async redirects() {
    return [{ source: "/play", destination: "/play/index.html", permanent: false }];
  },
};

export default nextConfig;
