// Lightweight text hygiene for anything users or models write into the world.
const BLOCK = [
  /\bn[i1!]gg/i, /\bf[a@]gg?[o0]t/i, /\bk[i1]ke\b/i, /\bretard(ed)?\b/i, /\btr[a@]nn(y|ie)/i,
  /\bc[u\*]nt\b/i, /\brape\b/i, /\bkill yourself\b/i, /\bkys\b/i,
];
const URL_RE = /(https?:\/\/|www\.)\S+/gi;

export function cleanText(input: string, max = 220): string {
  let s = String(input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<\/?(whisper|rumor|system)[^>]*>/gi, "")
    .replace(URL_RE, "[link]")
    .replace(/\s+/g, " ")
    .trim();
  for (const re of BLOCK) s = s.replace(new RegExp(re.source, "gi"), "▒▒▒");
  if (s.length > max) s = s.slice(0, max - 1) + "…";
  return s;
}

export function isAcceptable(input: string): boolean {
  const s = String(input ?? "");
  if (s.trim().length < 3) return false;
  return !BLOCK.some((re) => re.test(s));
}
