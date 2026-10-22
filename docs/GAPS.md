# Open questions and blockers

Checked: 18 October 2026. Remove or resolve rows as evidence becomes available.

| Question | Current evidence | Next action | Owner |
| :--- | :--- | :--- | :--- |
| Is our team already registered? | Registration closed on 11 October; no team account inspected | Check the existing registration through official sign in | To assign |
| Who is in the team? | No roster supplied; public interface allows up to five including the lead | Confirm members and registration links | To assign |
| Which NFT contract and network should we use? | Not specified on reviewed event pages. The code uses `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` on Monad (chain 143); on 21 Oct 2026 `rpc.monad.xyz` returned name "Chog Genesis" and totalSupply 1969 | Confirm with organisers that this is the intended collection | To assign |
| Which eligibility or reuse conditions apply? | Detailed terms not found on reviewed pages; existing work must be disclosed | Confirm relevant conditions with organizers | To assign |
| Which prize figures are final? | Published table totals differ from advertised pools | Ask organizers if this affects planning | To assign |
| Deployment | Live at https://chog-hivemind.vercel.app since 21 Oct 2026, deployed from PR #1 by CLI; tick cron runs on `main` against Turso. Not connected to GitHub, and `/world` is not deployed yet | Merge PR #1, then redeploy from `main` (or connect the repo in Vercel) | To assign |
| Claude API key and budget | None configured; the offline brain writes template text | Add `ANTHROPIC_API_KEY` with a spend limit | To assign |
| 7 tokens missing metadata | IPFS fetch failed for 7 of 1,969 during snapshot | Re-run `npm run snapshot`, then `seed`, `thumbs`, `atlas` | To assign |
| Whisper tested with a real holder? | Only the non-holder rejection was tested | Test with a wallet that holds a Chog Genesis | To assign |
| Are some Chogs hidden inside POI markers? | Unverified guess, 2026-10-21. `-- --select=111` flew to Hollow of Skulls, but #111 (x −5.2, z −105.3) wasn't visible and the Status Window didn't open. A mint octagon sat at screen center | Re-run with the server and check whether the dungeon marker covers Chogs standing at the POI center. If so, the server's spawn radius or the marker size needs to change (world side) | Developer A / B |
| Selected Chog hidden behind its workplace | Seen 2026-10-21 in native recordings: `--select=6` and `--select=2` flew the camera so that a building roof covered the Chog standing at the door | Camera (`camera_rig.gd`, shared) could look from the door side or pull back; or the server could stand workers on the far side. Needs an agreement between A and B | Developer A / B |
| Characters on integrated GPUs (web build): thin margin | 2026-10-21, after the shared prop pieces: Intel Iris Xe holds 63–67 FPS with p95 16.2–16.9 ms, and 19.3 ms p95 while all 1,962 walk (see DEMO.md) | If the world or effects add GPU cost, check again; next levers are hiding props or limbs beyond a camera distance, or a smaller body mesh | Developer B |
| WORLD_BIBLE jobs, cheats and skills | Designed, not implemented | Decide what fits before the deadline | To assign |

## Resolved answers

No answers recorded yet. For each answer, add the date, source link, exact practical implication and who confirmed it.
