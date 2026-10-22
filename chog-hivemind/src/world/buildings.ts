// Building interiors: who works there, what they said lately, and the story beat of the place.
import { perVersion } from "../lib/cache";
import { all, getState } from "../lib/db";
import { JOB_BY_ID } from "../sim2/season";
import { positions, WORLD, type WorldBuilding } from "./data";

const DUNGEON_BY_REGION = new Map<string, string>();
for (const p of WORLD.pois) if (p.kind === "dungeon" && !DUNGEON_BY_REGION.has(p.region)) DUNGEON_BY_REGION.set(p.region, p.name);

const GENERAL: Record<string, string> = {
  emberforge: "the General of Liquidation", tidecry: "the Drowned Archivist", prism: "the Mirror Wraith",
  dreamveil: "the Nightmare Shepherd", capital: "a shadow of the Demon King", hollow: "the Bone Choir",
};

function story(b: WorldBuilding, season: number): string {
  const city = b.city;
  const dungeon = DUNGEON_BY_REGION.get(b.region) ?? "the old ruins";
  const general = GENERAL[b.region] ?? "a Demon General";
  const S: Record<string, string> = {
    guild_hall: `The quest board of ${city}'s guild is buried in bounties. Scouts swear ${general} stirs beneath ${dungeon}. Every morning tanks, healers, strikers and buffers form parties here. One of them may become the Hero of Season ${season}.`,
    tavern: `Warm light, spilled ale and louder rumors. Whatever the stars whisper to a Chog, it gets retold here by nightfall, usually wrong. Adventurers drink to the fallen and argue about who will face the Demon King.`,
    blacksmith: `The forge never cools. Every blade an adventurer carries toward ${dungeon} was hammered here, and the smith knows which ones came back.`,
    weaponsmith: `Racks of blades and spears line the walls. Strikers come here first after a Constellation grants them a new skill: a new technique deserves a new edge.`,
    armorsmith: `Dented shields hang beside new ones. Tanks of ${city} trust this shop with their lives against ${general}.`,
    alchemist: `Bubbling cauldrons, glowing vials, a faint smell of frog. Healers stock up here before every raid; nobody asks what goes into the blue ones.`,
    library: `Endless shelves of chronicles. Somewhere in these pages is the record of every past Hero, and the weakness of every Demon King that came before.`,
    academy: `Mages teach young Chogs to read the Star Stream. They say a Constellation's hint is easier to hear for those who studied here.`,
    temple: `Candles for the fallen and blessings for the brave. Priests here revive injured adventurers and pray that the stars choose kindly this season.`,
    keep: `The City Hall of ${city}. Administrators post decrees, set bounties and argue about the coming Demon King. The guards are nervous.`,
    castle: `The Royal Castle of the Hive Capital. From this throne room every nation's bounties are funded, and here the Hero of the season will be crowned.`,
    spire: `The Election Hall under the Hive Spire. The swarm votes here for its Sovereign. Constellations watch the ballots as closely as they watch the battlefields.`,
    barracks: `Soldiers drill at dawn and stand night watch. When monsters raid ${city}, they hold the walls until the adventurers arrive.`,
    colosseum: `Sand, banners and roaring crowds. Duelists test new skills here, and rival parties settle their arguments before marching on the generals.`,
    dungeon: `${b.city}: a portal of green fire. Monsters pour out when night falls. Parties that clear its depths weaken the seal on the Demon King's castle.`,
    demon_castle: `The throne room of the Demon King. Chains, cold purple light and a silence that waits. When the four generals fall, the seal breaks, and one Chog will walk up this carpet as the Hero.`,
    post_office: `Letters from the stars arrive here first. Couriers carry quests and hints from the Constellations to every corner of Monadia.`,
    general_store: `Rope, rations, torches and gossip. Every party passes through before heading toward ${dungeon}.`,
    restaurant: `Full bellies make brave adventurers. The cooks of ${city} feed the guild before every raid.`,
    bakery: `Warm bread at dawn. Even the grumpiest soldier smiles here.`,
    flower_shop: `Flowers for the brave, for the fallen and for that one Chog you keep running into at the tavern.`,
    toyshop: `Wind-up Chogs, plush Demon Kings and a very popular "Hero of the Season" figurine that gets repainted every season.`,
    tailor: `Capes, cloaks and guild colors. A Hero needs to look the part.`,
    jeweler: `Gems that hum with mana. Buffers swear a good ring makes their blessings stronger.`,
    market: `Stalls from every nation. Prices rise whenever the Demon King stirs.`,
  };
  return S[b.type] ?? `${b.name || b.type} in ${city}.`;
}

export async function buildingDetail(id: number) {
  const b = WORLD.buildings?.[id];
  if (!b) return null;
  const season = Number(await getState("season", "0"));
  const pos = await perVersion("positions", positions);
  const here: number[] = [];
  pos.building.forEach((bi, k) => {
    if (bi === id) here.push(pos.ids[k]);
  });
  let keepers: any[] = [];
  if (here.length) {
    const rows = await all<any>(
      `SELECT c.id, c.name, cs.job, cs.level FROM chogs c LEFT JOIN chog_season cs ON cs.chog_id = c.id AND cs.season = ?
       WHERE c.id IN (${here.map(() => "?").join(",")}) ORDER BY cs.level DESC, c.id LIMIT 60`,
      [season, ...here],
    );
    keepers = rows.map((r) => {
      const job = r.job ? JOB_BY_ID[r.job] : undefined;
      const tier = Math.min(4, Math.floor((Number(r.level ?? 1) - 1) / 10));
      return { id: Number(r.id), name: r.name, job: job?.name ?? "", title: job?.titles[tier] ?? "" };
    });
  }
  const recent = here.length
    ? await all<any>(
        `SELECT p.text, c.name FROM posts p JOIN chogs c ON c.id = p.chog_id
         WHERE p.chog_id IN (${here.slice(0, 200).map(() => "?").join(",")}) AND p.kind IN ('post','reply')
         ORDER BY p.id DESC LIMIT 6`,
        here.slice(0, 200),
      )
    : [];
  return {
    building: b,
    season,
    story: story(b, season),
    count: here.length,
    keepers,
    recent: recent.map((r) => ({ name: r.name, text: r.text })),
  };
}
