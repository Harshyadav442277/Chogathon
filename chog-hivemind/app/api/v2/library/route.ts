import { QUESTS, SKILLS } from "@/sim3/sim";

// The skill and quest libraries Constellations choose from (static data).
export async function GET() {
  return Response.json(
    { skills: SKILLS, quests: QUESTS.filter((q) => !q.boss || q.boss === "seal") },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
