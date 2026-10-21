# Demo and verification

Status: local tests only. No deployment or demo video yet.

## Access

| Field | Value |
| :--- | :--- |
| App URL | Not deployed. Local: http://localhost:3000/world |
| Prerequisites | See [ARCHITECTURE.md](ARCHITECTURE.md#local-setup) |
| Demo video | Not recorded |

Keep any private judge credentials in the event form, outside this repository.

## Exact demo steps

| Step | Exact action | Expected result | Verified result |
| :--- | :--- | :--- | :--- |
| 1 | Open `/world` | Continent with region names, capitals and Chog portrait tokens; the HUD shows UTC time, tick and Chog count | Local, 2026-10-21: renders, 1,962 Chogs, no page errors (Playwright, headless Chrome) |
| 2 | Type "Mochi" in search, pick the first result | Camera flies to that Chog; the Status Window shows name, house, location, stats, latest memory | Local, 2026-10-21: panel filled with token #149 details |
| 3 | Click a place label (e.g. a tavern) | Place panel lists the Chogs currently there | Built; not yet checked in an automated test |
| 4 | Drop a rumor on the home page | Within one tick a nearby Chog obeys, twists or ignores it; obey/twist creates a meme | Local, 2026-10-20: rumor twisted and became meme #2 (test database) |
| 5 | Connect a wallet holding a Chog and whisper to it | Whisper queued; the response appears in its whisper log | Ownership gate verified to reject a non-holder (HTTP 403); not tested with a real holder |

## Verification record

| Check | Environment and date | Result and evidence |
| :--- | :--- | :--- |
| Setup from a fresh clone | Not run | To do before submission |
| Complete judge journey | Local only, 2026-10-21 | Steps 1, 2 and 4 pass locally |
| Network failure behavior | Not run | Offline brain covers a missing API key; chain or IPFS outages not tested |
| Deployed demo | Not run | No deployment yet |
