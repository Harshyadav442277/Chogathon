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
    // The game is the whole site: every page route opens the game (its title screen says "Enter Monadia").
    // APIs, /play/* files and static assets are untouched.
    const game = "/play/index.html";
    return ["/", "/play", "/world", "/times", "/leaderboard", "/about", "/chog/:path*", "/meme/:path*"].map((source) => ({
      source, destination: game, permanent: false,
    }));
  },
};

export default nextConfig;
