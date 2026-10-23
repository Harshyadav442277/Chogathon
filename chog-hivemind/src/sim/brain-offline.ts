// Procedural fallback brain: no API key needed, keeps the world alive.
import type { Decision, FeedItem, Injection, StepInput } from "./types";
import { LOCATION_IDS, locationName, MOODS, house } from "./world";

const r = Math.random;
const choice = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const short = (s: string, n = 70) => clip(s.replace(/\s+/g, " ").trim(), n);

const OPENERS: Record<string, string[]> = {
  laser: ["ok listen.", "hot take:", "nobody is ready for this:", "calling it now:", "zap alert:"],
  teardrop: ["i keep thinking about this:", "is it just me or", "soft reminder:", "i'm worried that", "honestly"],
  glass: ["notice how", "connect the dots:", "follow the wallet:", "small observation:", "curious that"],
  moonbeam: ["gm hive.", "dreamt about this:", "vibe check:", "manifesting:", "today feels like"],
};

const REACTIONS: Record<string, string[]> = {
  laser: ["say it louder.", "this but harder.", "who's with me", "weak take, here's the real one:", "finally someone said it."],
  teardrop: ["this made me feel things.", "please be careful with this.", "are we sure about this?", "i'll remember this.", "oof. same."],
  glass: ["who benefits from this narrative?", "the timing is suspicious.", "receipts or it didn't happen.", "there's a pattern here.", "noted. filed. watching."],
  moonbeam: ["love this energy.", "this is the timeline.", "beautiful. bullish on vibes.", "we're all gonna make it.", "sending moonbeams."],
};

const TWISTS: Record<string, string[]> = {
  laser: ["and House Laser will make it happen by friday.", "and anyone who disagrees can meet me at the arcade.", "but twice as loud."],
  teardrop: ["but what if it hurts someone?", "and i'm scared it's true.", "which means we need to look after each other."],
  glass: ["but that's exactly what they want you to think.", "and the docks are hiding the rest.", "which explains a lot about town hall."],
  moonbeam: ["and honestly that's kind of magical.", "so let's throw a party about it at the pond.", "which means the moon is closer than we think."],
};

function originalPost(s: StepInput): string {
  const { agent, world } = s;
  const p = agent.persona;
  const h = agent.house;
  const op = choice(OPENERS[h] ?? OPENERS.moonbeam);
  const options = [
    () => `${op} ${p.obsession.split(" (")[0]} is the only thing that matters this week. ${p.catchphrase}`,
    () => `${op} ${locationName(agent.location)} is ${choice(["packed", "weirdly quiet", "on fire", "full of skulls", "smelling like candles"])} right now.`,
    () => `as a ${p.job}, ${choice(["i can confirm", "i deny everything about", "i have notes on"])} ${choice(["the market", "the election", "the docks", "the arcade leaderboard", "the pond frogs"])}. ${p.catchphrase}`,
    () => (world.question ? `${op} on "${short(world.question, 80)}" — ${choice(["yes, obviously.", "absolutely not.", "depends who's asking.", "the real answer scares me."])}` : `${op} the hive is restless today.`),
    () => (world.event ? `${choice(["just heard:", "update from town:", "can't stop thinking about"])} ${short(world.event.title, 90).toLowerCase()}. ${choice(REACTIONS[h] ?? REACTIONS.moonbeam)}` : `${op} ${house(h).creed.toLowerCase()}`),
    () => `${house(h).name} creed: ${house(h).creed.toLowerCase()} ${p.catchphrase}`,
  ];
  return clip(choice(options)());
}

function memeful(feed: FeedItem[]) {
  return feed.filter((f) => f.meme_id);
}

// Holder commands other than whispers: journeys (nudge), introductions and gifts.
function holderStep(s: StepInput, inj: Injection): Decision {
  const { agent, feed } = s;
  const h = agent.house;
  const p = agent.persona;
  const fit = agent.bond / 100 - (p.contrarian ? 0.15 : 0);
  const roll = r();

  if (inj.kind === "nudge" && inj.location) {
    const dest = locationName(inj.location);
    if (agent.location === inj.location)
      return { action: "post", text: clip(`already at ${dest.toLowerCase()}, my human. ${p.catchphrase}`), injection_response: "obey", mood: "smug", memory: `My human sent me to ${dest}. I was already there.` };
    if (roll < fit * 0.7 + 0.3)
      return { action: "move", location: inj.location, injection_response: "obey", mood: "curious", memory: `My human sent me to ${dest}, so I went.` };
    if (roll < 0.85) {
      const detour = choice(LOCATION_IDS.filter((l) => l !== inj.location && l !== agent.location));
      return { action: "move", location: detour, injection_response: "twist", mood: "smug", memory: `My human sent me to ${dest}. I took a detour to ${locationName(detour)}.` };
    }
    return {
      action: "post",
      text: clip(`my human wants me at ${dest.toLowerCase()}. i'm staying right here at ${locationName(agent.location).toLowerCase()}. ${p.catchphrase}`),
      injection_response: "ignore",
      mood: "grumpy",
      memory: `I refused to go to ${dest}.`,
    };
  }

  if (inj.kind === "introduce" && inj.target_chog) {
    const name = inj.target_name ?? `#${inj.target_chog}`;
    const handle = `@${name.replace(/\s+/g, "")}`;
    const theirs = feed.find((f) => f.chog_id === inj.target_chog);
    if (roll < fit * 0.7 + 0.3) {
      const text = clip(`${handle} ${choice(["my human says we should be friends.", "heard a lot about you. gm.", "we should team up."])} ${p.catchphrase}`);
      return theirs
        ? { action: "reply", target_post_id: theirs.id, text, injection_response: "obey", mood: "hyped", memory: `I was introduced to ${name} and said hi.` }
        : { action: "post", text, injection_response: "obey", mood: "hyped", memory: `I was introduced to ${name} and said hi.` };
    }
    if (roll < 0.85) {
      const text = clip(`${handle} my human wants us to meet. ${choice(REACTIONS[h] ?? REACTIONS.moonbeam)}`);
      const memory = `I sized up ${name} after my human introduced us.`;
      return theirs
        ? { action: "reply", target_post_id: theirs.id, text, injection_response: "twist", mood: "suspicious", memory }
        : { action: "post", text, injection_response: "twist", mood: "suspicious", memory };
    }
    return { action: "idle", injection_response: "ignore", mood: "grumpy", memory: `My human tried to introduce me to ${name}. Not interested.` };
  }

  // Gift: nearly always welcome. Contrarians sometimes play it cool.
  const gift = short(inj.text, 60);
  if (roll < (p.contrarian ? 0.55 : 0.85))
    return {
      action: "post",
      text: clip(`my human gave me ${gift}. ${choice(["best day.", "feeling loved.", "i will guard it with my life.", "the hive is jealous."])} ${p.catchphrase}`),
      injection_response: "obey",
      mood: "hyped",
      memory: `My human gave me ${gift}.`,
    };
  if (roll < 0.95)
    return {
      action: "post",
      text: clip(`${gift}? i guess. ${choice(TWISTS[h] ?? TWISTS.moonbeam)}`),
      injection_response: "twist",
      mood: "smug",
      memory: `My human gave me ${gift}. I acted unimpressed.`,
    };
  return { action: "idle", injection_response: "ignore", mood: "grumpy", memory: `My human offered me ${gift}. I left it on the doorstep.` };
}

export async function offlineStep(s: StepInput): Promise<Decision> {
  const { agent, feed, injection } = s;
  const h = agent.house;
  const p = agent.persona;
  const mood = r() < 0.3 ? choice(MOODS) : agent.mood;

  if (injection && injection.kind !== "whisper" && injection.kind !== "rumor") return holderStep(s, injection);
  if (injection) {
    const heard = short(injection.text, 120);
    const fit = injection.kind === "whisper" ? agent.bond / 100 : 0.35;
    const roll = r();
    const contrarianPenalty = p.contrarian ? 0.15 : 0;
    if (roll < fit * 0.75 - contrarianPenalty + 0.15) {
      return {
        action: "post",
        text: clip(`${choice(OPENERS[h] ?? OPENERS.moonbeam)} ${heard} ${p.catchphrase}`),
        injection_response: "obey",
        mood: "inspired",
        memory: `I spread an idea I heard: "${short(heard, 60)}".`,
      };
    }
    if (roll < 0.8) {
      return {
        action: "post",
        text: clip(`${choice(["rumor says", "word is", "a voice told me"])} ${heard}... ${choice(TWISTS[h] ?? TWISTS.moonbeam)}`),
        injection_response: "twist",
        mood: "smug",
        memory: `I heard "${short(heard, 60)}" and gave it my own spin.`,
      };
    }
    return {
      action: injection.kind === "whisper" ? "post" : "idle",
      text: injection.kind === "whisper"
        ? clip(`my human wants me to say "${short(heard, 60)}". nah. ${p.catchphrase}`)
        : undefined,
      injection_response: "ignore",
      mood: "grumpy",
      memory: `I refused to repeat "${short(heard, 60)}".`,
    };
  }

  const roll = r();
  const memePosts = memeful(feed);
  if (memePosts.length && roll < 0.14) {
    const sameHouse = memePosts.filter((m) => m.house === h);
    const target = choice(sameHouse.length && r() < 0.6 ? sameHouse : memePosts);
    if (r() < 0.55)
      return {
        action: "repost",
        target_post_id: target.id,
        echo_meme_id: target.meme_id ?? undefined,
        mood,
        memory: `I reposted ${target.name}: "${short(target.text, 50)}".`,
      };
    return {
      action: "reply",
      target_post_id: target.id,
      text: clip(`${choice(REACTIONS[h] ?? REACTIONS.moonbeam)} ${r() < 0.4 ? p.catchphrase : ""}`.trim()),
      echo_meme_id: target.house === h || r() < 0.4 ? (target.meme_id ?? undefined) : undefined,
      mood,
      memory: `I replied to ${target.name} about "${short(target.text, 50)}".`,
    };
  }
  const popular = feed.filter((f) => f.chog_id > 0 && f.kind !== "repost" && f.likes + f.replies + f.reposts >= 2);
  if (popular.length && roll < 0.38) {
    const target = popular.sort((a, b) => b.likes + 2 * b.reposts - (a.likes + 2 * a.reposts))[0];
    return { action: "repost", target_post_id: target.id, mood, memory: `I boosted ${target.name}'s post.` };
  }
  if (feed.length && roll < 0.5) {
    const target = choice(feed.filter((f) => f.chog_id > 0).slice(0, 5).concat(feed.slice(0, 1)));
    return {
      action: "reply",
      target_post_id: target.id,
      text: clip(`@${target.name.replace(/\s+/g, "")} ${choice(REACTIONS[h] ?? REACTIONS.moonbeam)}`),
      mood,
      memory: `I talked with ${target.name}.`,
    };
  }
  if (feed.length && roll < 0.57) {
    const target = choice(feed.slice(0, 6));
    return { action: "like", target_post_id: target.id, mood };
  }
  if (feed.length && roll < 0.62) {
    const target = choice(feed.slice(0, 6));
    return { action: "follow", target_chog_id: target.chog_id, mood, memory: `I started following ${target.name}.` };
  }
  if (roll < 0.7) {
    const dest = r() < 0.4 ? p.home : choice(LOCATION_IDS);
    return { action: "move", location: dest, mood, memory: `I wandered to ${locationName(dest)}.` };
  }
  if (roll < 0.95) return { action: "post", text: originalPost(s), mood };
  return { action: "idle", mood: "sleepy" };
}

export function offlineChat(name: string, persona: { catchphrase: string; house: string; obsession: string }, msg: string, recent: string[]): string {
  const h = persona.house;
  const lead = choice(OPENERS[h] ?? OPENERS.moonbeam);
  const ref = recent.length ? ` lately i've been saying "${short(recent[0], 70)}".` : "";
  return clip(
    `${lead} you asked "${short(msg, 60)}". ${choice(REACTIONS[h] ?? REACTIONS.moonbeam)}${ref} mostly i think about ${persona.obsession.split(" (")[0]}. ${persona.catchphrase}`,
    400,
  );
}
