// Export the Godot game (../game) as a single-threaded web build into public/play/.
//   GODOT_BIN=/path/to/godot npm run play:build
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const godot = process.env.GODOT_BIN || "C:/Users/avara/tools/godot/Godot_v4.7.2-stable_win64_console.exe";
const project = fileURLToPath(new URL("../../game/", import.meta.url));
const out = fileURLToPath(new URL("../public/play/", import.meta.url));

if (!existsSync(godot)) {
  console.error(`Godot not found at ${godot}. Set GODOT_BIN.`);
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync(godot, ["--headless", "--path", project, "--import"], { stdio: "inherit" });
execFileSync(godot, ["--headless", "--path", project, "--export-release", "Web", join(out, "index.html")], { stdio: "inherit" });
for (const f of readdirSync(out)) console.log(`${f}  ${(statSync(join(out, f)).size / 1e6).toFixed(2)} MB`);
