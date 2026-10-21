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
| WORLD_BIBLE jobs, cheats and skills | Designed, not implemented | Decide what fits before the deadline | To assign |

## Resolved answers

No answers recorded yet. For each answer, add the date, source link, exact practical implication and who confirmed it.
