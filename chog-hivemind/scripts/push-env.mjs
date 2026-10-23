// Copy .env.local to Vercel (production) and GitHub Actions secrets without printing any value.
//   node scripts/push-env.mjs            both
//   node scripts/push-env.mjs --vercel   Vercel only
//   node scripts/push-env.mjs --github   GitHub only
//   --env <path>                         read another env file instead of ./.env.local
// Needs: `vercel link` done in this folder, and `gh auth login` on the repo owner's account.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = "Harshyadav442277/Chogathon";
const VERCEL_KEYS = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "ANTHROPIC_API_KEY", "SESSION_SECRET", "CRON_SECRET", "JUDGE_CODE", "JUDGE_CHOG_IDS", "AGENT_MODEL", "CHAT_MODEL", "EDITION_MODEL", "MONAD_RPC"];
const GITHUB_KEYS = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "ANTHROPIC_API_KEY"];
const SECRET = new Set(["TURSO_AUTH_TOKEN", "ANTHROPIC_API_KEY", "SESSION_SECRET", "CRON_SECRET", "JUDGE_CODE"]);

const envArg = process.argv.indexOf("--env");
const envFile = envArg > 0 ? process.argv[envArg + 1] : new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const only = process.argv.includes("--vercel") ? "vercel" : process.argv.includes("--github") ? "github" : null;
const shell = process.platform === "win32";

for (const k of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "SESSION_SECRET", "CRON_SECRET"]) {
  if (!env[k]) throw new Error(`${k} is empty in .env.local`);
}

if (only !== "github") {
  for (const k of VERCEL_KEYS) {
    if (!env[k]) { console.log(`vercel  ${k}: skipped (empty)`); continue; }
    const args = ["env", "add", k, "production", "--force", "--yes", SECRET.has(k) ? "--sensitive" : "--no-sensitive"];
    execFileSync("vercel", args, { input: env[k], stdio: ["pipe", "ignore", "inherit"], shell });
    console.log(`vercel  ${k}: set`);
  }
}
if (only !== "vercel") {
  for (const k of GITHUB_KEYS) {
    if (!env[k]) { console.log(`github  ${k}: skipped (empty)`); continue; }
    execFileSync("gh", ["secret", "set", k, "--repo", REPO], { input: env[k], stdio: ["pipe", "ignore", "inherit"], shell });
    console.log(`github  ${k}: set`);
  }
}
