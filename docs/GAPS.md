# Open questions and blockers

Checked: 18 October 2026. Remove or resolve rows as evidence becomes available.

| Question | Current evidence | Next action | Owner |
| :--- | :--- | :--- | :--- |
| Is our team already registered? | Registration closed on 11 October; no team account inspected | Check the existing registration through official sign in | To assign |
| Who is in the team? | No roster supplied; public interface allows up to five including the lead | Confirm members and registration links | To assign |
| Which NFT contract and network should we use? | Not specified on reviewed event pages | Verify official technical details before integration | To assign |
| Which eligibility or reuse conditions apply? | Detailed terms not found on reviewed pages; existing work must be disclosed | Confirm relevant conditions with organizers | To assign |
| Which prize figures are final? | Published table totals differ from advertised pools | Ask organizers if this affects planning | To assign |
| Deployment | App runs locally only | Create Turso DB, Vercel project (root `chog-hivemind`), GitHub secrets; run the tick workflow | To assign |
| Claude API key and budget | None configured; the offline brain writes template text | Add `ANTHROPIC_API_KEY` with a spend limit | To assign |
| 7 tokens missing metadata | IPFS fetch failed for 7 of 1,969 during snapshot | Re-run `npm run snapshot`, then `seed`, `thumbs`, `atlas` | To assign |
| Whisper tested with a real holder? | Only the non-holder rejection was tested | Test with a wallet that holds a Chog Genesis | To assign |
| Are some Chogs hidden inside POI markers? | Unverified guess, 2026-10-21. `-- --select=111` flew to Hollow of Skulls, but #111 (x −5.2, z −105.3) wasn't visible and the Status Window didn't open. A mint octagon sat at screen center | Re-run with the server and check whether the dungeon marker covers Chogs standing at the POI center. If so, the server's spawn radius or the marker size needs to change (world side) | Developer A / B |
| Selected Chog hidden behind its workplace | Seen 2026-10-21 in native recordings: `--select=6` and `--select=2` flew the camera so that a building roof covered the Chog standing at the door | Camera (`camera_rig.gd`, shared) could look from the door side or pull back; or the server could stand workers on the far side. Needs an agreement between A and B | Developer A / B |
| Characters too heavy for integrated GPUs in the web build | Measured 2026-10-21: on Intel Iris Xe, median frame 17.8 ms with props vs 13.9 ms without and 12.5 ms hidden; p95 33.8 ms with props (see DEMO.md) | Cut prop vertices: a shared 'pole + head' prop per hand, shaped per prop by the shader, instead of 10 separate props in every Chog's mesh. Re-measure on Iris Xe and aim for p95 under 16.7 ms | Developer B |
| WORLD_BIBLE jobs, cheats and skills | Designed, not implemented | Decide what fits before the deadline | To assign |

## Resolved answers

No answers recorded yet. For each answer, add the date, source link, exact practical implication and who confirmed it.
