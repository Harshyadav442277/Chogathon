import type { Persona } from "./world";

export type Agent = {
  id: number;
  name: string;
  image: string | null;
  house: string;
  location: string;
  mood: string;
  bond: number;
  influence: number;
  owner: string | null;
  persona: Persona;
};

export type FeedItem = {
  id: number;
  chog_id: number;
  name: string;
  house: string;
  kind: string;
  text: string;
  meme_id: number | null;
  depth: number;
  likes: number;
  reposts: number;
  replies: number;
  cheers: number;
  tick: number;
  location: string | null;
};

export type InjectionKind = "whisper" | "rumor" | "nudge" | "introduce" | "gift";
export const HOLDER_KINDS: InjectionKind[] = ["whisper", "nudge", "introduce", "gift"];

export type Injection = {
  id: number;
  kind: InjectionKind;
  chog_id: number | null;
  location: string | null;
  target_chog: number | null;
  target_name?: string | null;
  author: string;
  text: string;
};

export type Memory = { text: string; importance: number; tick: number };

export type WorldContext = {
  tick: number;
  hourUtc: number;
  event: { title: string; body: string } | null;
  question: string | null;
  memes: { id: number; text: string; adopters: number }[];
};

export type Decision = {
  action: "post" | "reply" | "repost" | "like" | "follow" | "move" | "idle";
  target_post_id?: number;
  target_chog_id?: number;
  location?: string;
  text?: string;
  echo_meme_id?: number;
  injection_response?: "obey" | "twist" | "ignore" | "none";
  mood?: string;
  memory?: string;
};

export type StepInput = {
  agent: Agent;
  feed: FeedItem[];
  memories: Memory[];
  injection: Injection | null;
  world: WorldContext;
};
