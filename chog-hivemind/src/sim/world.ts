// World constants and the deterministic persona builder (traits + onchain life -> persona).

export const LOCATIONS = [
  { id: "plaza", name: "Purple Plaza", blurb: "the loud town square where every rumor starts" },
  { id: "market", name: "Mon Market", blurb: "stalls, haggling and price talk" },
  { id: "arcade", name: "Block 143 Arcade", blurb: "neon cabinets, speedrunners, trash talk" },
  { id: "gardens", name: "Gasless Gardens", blurb: "quiet paths for long thoughts" },
  { id: "docks", name: "Rug Docks", blurb: "shady deals and salty sailors" },
  { id: "hall", name: "Town Hall", blurb: "debates, petitions and the coming election" },
  { id: "cave", name: "Skull Cave", blurb: "where the night owls and ghosts gather" },
  { id: "pond", name: "Chog Pond", blurb: "frogs, fishing and gossip by the water" },
] as const;
export type LocationId = (typeof LOCATIONS)[number]["id"];
export const LOCATION_IDS = LOCATIONS.map((l) => l.id) as LocationId[];
export const locationName = (id: string) => LOCATIONS.find((l) => l.id === id)?.name ?? id;

export const HOUSES = [
  {
    id: "laser",
    name: "House Laser",
    color: "#ff4d6d",
    creed: "Act first, apologize never.",
    temperament: "fierce",
  },
  {
    id: "teardrop",
    name: "House Teardrop",
    color: "#4dabf7",
    creed: "Feel everything, forget nothing.",
    temperament: "wary",
  },
  {
    id: "glass",
    name: "House Glass",
    color: "#b197fc",
    creed: "See through every story.",
    temperament: "sly",
  },
  {
    id: "moonbeam",
    name: "House Moonbeam",
    color: "#ffd43b",
    creed: "Dream louder than the chart.",
    temperament: "dreamy",
  },
] as const;
export type HouseId = (typeof HOUSES)[number]["id"];
export const house = (id: string) => HOUSES.find((h) => h.id === id) ?? HOUSES[0];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}

const has = (v: string | undefined, words: string[]) =>
  !!v && words.some((w) => v.toLowerCase().includes(w));

function temperamentOf(eyes?: string): HouseId {
  if (has(eyes, ["laser", "visor", "fire", "angry", "viper"])) return "laser";
  if (has(eyes, ["cry", "tear", "worried", "dead", "sad"])) return "teardrop";
  if (has(eyes, ["side", "vertical", "xd", "glass", "retro"])) return "glass";
  if (has(eyes, ["heart", "happy", "round", "closed"])) return "moonbeam";
  return pick(["laser", "teardrop", "glass", "moonbeam"] as const, "eyes:" + eyes);
}

function voiceOf(mouth?: string): string {
  if (has(mouth, ["bubblegum", "clown", "puke", "wo"])) return "chaotic and jokey, lots of bits and callbacks";
  if (has(mouth, ["gold tooth", "coin", "drool"])) return "greedy hustler energy, always pitching a deal";
  if (has(mouth, ["lip bite", "flat"])) return "dry, deadpan one-liners";
  if (has(mouth, ["sad", "worried"])) return "anxious overthinker, hedges everything";
  if (has(mouth, ["smile"])) return "warm and hype, cheers everyone on";
  return pick(
    ["cryptic and poetic", "blunt and loud", "nerdy and precise", "sarcastic but kind"],
    "mouth:" + mouth,
  );
}

function jobOf(body?: string): string {
  const b = body?.toLowerCase() ?? "";
  if (has(b, ["tuxedo", "robe", "kings"])) return "fancy banker who runs the Mon Market vault";
  if (has(b, ["hoodie", "tee"])) return "indie dev shipping something nobody asked for";
  if (has(b, ["jersey", "trackset", "sleeveless"])) return "athlete who trains at the arcade";
  if (has(b, ["suit", "gangster", "vest"])) return "dockside fixer who knows a guy";
  if (has(b, ["armor", "dragon", "shark"])) return "self-appointed town guard";
  if (has(b, ["farmer", "hawaiian", "polo"])) return "pond-side farmer with strong opinions";
  if (has(b, ["homeless", "squid"])) return "street philosopher living on vibes";
  return pick(
    ["meme archivist", "night-shift validator", "rumor broker", "pixel painter", "candle reader", "mushroom chef"],
    "body:" + body,
  );
}

const OBSESSIONS = [
  "proving Monad is the fastest chain alive",
  "finding the legendary golden Chog",
  "becoming Mayor of the Hivemind",
  "collecting every rumor in town",
  "exposing who rugged the docks in 2023",
  "the perfect frog-shaped snack",
  "decoding what the Skulls whisper at night",
  "winning every arcade high score",
  "starting a band called 143 TPS",
  "teaching the town about patience",
];

export type Persona = {
  id: number;
  name: string;
  house: HouseId;
  temperament: string;
  voice: string;
  job: string;
  obsession: string;
  home: LocationId;
  contrarian: boolean;
  nightOwl: boolean;
  tier: string;
  loyalty: "loyal" | "settled" | "nomad";
  homes: number;
  catchphrase: string;
  bio: string;
  traits: Record<string, string>;
  activity: number;
  activeHours: number[];
};

const CATCHPHRASES: Record<HouseId, string[]> = {
  laser: ["send it.", "zap first, ask later.", "fortune favors the fried.", "no brakes on this chog."],
  teardrop: ["i felt that.", "remember this moment.", "we'll be okay. probably.", "my heart is a ledger."],
  glass: ["interesting... very interesting.", "follow the wallet.", "i see what you did there.", "it's always deeper."],
  moonbeam: ["vibes are onchain.", "dream bigger, chog.", "gm forever.", "the moon is a state of mind."],
};

export function buildPersona(
  id: number,
  name: string,
  traits: Record<string, string>,
  homes = 1,
): Persona {
  const h = temperamentOf(traits.Eyes);
  const hm = HOUSES.find((x) => x.id === h)!;
  const nightOwl = has(traits.Form, ["skull"]) || has(traits.Base, ["skull"]);
  const contrarian = (traits.Side || "").toLowerCase() === "left";
  const loyalty = homes <= 1 ? "loyal" : homes <= 3 ? "settled" : "nomad";
  const home: LocationId = nightOwl
    ? "cave"
    : pick(LOCATION_IDS.filter((l) => l !== "cave"), "bg:" + (traits.Background || id));
  const obsession = traits.Head
    ? `${pick(OBSESSIONS, "head:" + traits.Head)} (never takes off the ${traits.Head})`
    : pick(OBSESSIONS, "head:" + id);
  const job = jobOf(traits.Body);
  const voice = voiceOf(traits.Mouth);
  const catchphrase = pick(CATCHPHRASES[h], "cp:" + id);
  const activity = 0.35 + (hash("act:" + id) % 50) / 100; // 0.35 - 0.84
  const start = nightOwl ? 18 : 6 + (hash("wake:" + id) % 5);
  const activeHours = Array.from({ length: 16 }, (_, i) => (start + i) % 24);
  const bio =
    `${name}, ${hm.name} (${hm.temperament}). ${job[0].toUpperCase() + job.slice(1)}. ` +
    `Obsessed with ${obsession}. ` +
    (loyalty === "loyal"
      ? "Has lived in the same home since mint."
      : loyalty === "nomad"
        ? `Has moved homes ${homes} times and trusts nobody easily.`
        : `Has had ${homes} homes.`) +
    (contrarian ? " Natural contrarian." : "") +
    (nightOwl ? " A ghostly night owl." : "");
  return {
    id,
    name,
    house: h,
    temperament: hm.temperament,
    voice,
    job,
    obsession,
    home,
    contrarian,
    nightOwl,
    tier: traits.Tier || "Common",
    loyalty,
    homes,
    catchphrase,
    bio,
    traits,
    activity,
    activeHours,
  };
}

const NICK_A = [
  "Mochi", "Biscuit", "Pickle", "Noodle", "Waffle", "Pudding", "Bean", "Tofu", "Nugget", "Sprout", "Pebble", "Muffin",
  "Dumpling", "Turnip", "Sushi", "Taco", "Bagel", "Clover", "Juniper", "Ziggy", "Pixel", "Byte", "Glitch", "Static",
  "Echo", "Nova", "Comet", "Orbit", "Quasar", "Nebula", "Ember", "Blaze", "Frost", "Misty", "Storm", "Thunder",
  "Puddle", "Ripple", "Lily", "Moss", "Fern", "Basil", "Pepper", "Ginger", "Olive", "Peanut", "Cashew", "Mango",
  "Kiwi", "Plum", "Fig", "Yuzu", "Boba", "Matcha", "Latte", "Mocha", "Cocoa", "Sugar", "Honey", "Toffee",
  "Gizmo", "Widget", "Sprocket", "Bolt", "Rivet", "Gadget", "Ratchet", "Chip", "Diode", "Fuse", "Volt", "Watt",
  "Bandit", "Rascal", "Scamp", "Rogue", "Maverick", "Outlaw", "Ranger", "Scout", "Sailor", "Captain", "Admiral", "Duke",
  "Baron", "Count", "Sir Hops", "Lady Lux", "Professor", "Doc", "Judge", "Mayor-ish", "Wizard", "Oracle", "Sage", "Monk",
];
const NICK_B = ["", "", "", "", " Jr", " the Bold", " the Shy", " the Wise", " Prime", " II", " the Loud", " the Quiet"];

export function nickname(id: number): string {
  return NICK_A[hash("nick:" + id) % NICK_A.length] + NICK_B[hash("suf:" + id) % NICK_B.length];
}

export const MOODS = ["curious", "hyped", "suspicious", "sleepy", "grumpy", "inspired", "anxious", "smug", "chill"];
