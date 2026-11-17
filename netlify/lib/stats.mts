import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";

/* Visitor statistics, kept by the store itself. No cookies, no outside company.
   Each day is one record under "day/<YYYY-MM-DD>" (Lagos time) holding counts only.
   To count a visitor once a day we keep a short code made from their connection and browser
   mixed with a random salt that is replaced every day. The salt is thrown away at the end of
   the day and the day's codes are deleted, so nobody (us included) can link a visit to a person
   or to the same person on another day. IP addresses are never stored. */

export type Day = {
  views: number;
  visitors: number;
  seen?: string[];
  pages: Record<string, number>;
  products: Record<string, number>;
  sources: Record<string, number>;
  devices: Record<string, number>;
};

const stats = () => getStore({ name: "stats", consistency: "strong" });
const KEEP_DAYS = 400;
const MAX_KEYS = 150;

/* Nigeria has no daylight saving: Lagos is always UTC+1. */
export const dayOf = (time: number | string = Date.now()) => new Date(new Date(time).getTime() + 3600_000).toISOString().slice(0, 10);

const blank = (): Day => ({ views: 0, visitors: 0, seen: [], pages: {}, products: {}, sources: {}, devices: {} });

const bump = (map: Record<string, number>, key: string) => {
  if (!key) return;
  if (!(key in map) && Object.keys(map).length >= MAX_KEYS) key = "Other";
  map[key] = (map[key] || 0) + 1;
};

/* Today's salt. When the day changes, the old salt is replaced and yesterday's codes are dropped. */
async function saltFor(day: string): Promise<string> {
  const saved = (await stats().get("salt", { type: "json" })) as { day: string; salt: string } | null;
  if (saved?.day === day) return saved.salt;
  await stats().setJSON("salt", { day, salt: randomBytes(32).toString("hex") });
  if (saved?.day) await forgetCodes(saved.day);
  await prune();
  /* Two first-visits-of-the-day can race: whichever salt was stored last is the one everyone uses. */
  return ((await stats().get("salt", { type: "json" })) as { salt: string }).salt;
}

async function forgetCodes(day: string) {
  await changeDay(day, record => { delete record.seen; return record; }, true);
}

async function prune() {
  const oldest = dayOf(Date.now() - KEEP_DAYS * 86400_000);
  const { blobs } = await stats().list({ prefix: "day/" });
  for (const blob of blobs) if (blob.key.slice(4) < oldest) await stats().delete(blob.key);
}

/* Conditional read-modify-write, retrying if another visit landed at the same moment. */
async function changeDay(day: string, change: (record: Day) => Day, onlyExisting = false) {
  const key = `day/${day}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const entry = await stats().getWithMetadata(key, { type: "json" });
    if (!entry && onlyExisting) return;
    const record = change(entry ? ({ ...blank(), ...(entry.data as Day) }) : blank());
    const options = entry?.etag ? { onlyIfMatch: entry.etag } : entry ? {} : { onlyIfNew: true };
    if ((await stats().setJSON(key, record, options)).modified) return;
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 80));
  }
}

export type Hit = { ip: string; agent: string; page: string; product: string; source: string; device: string };

export async function record(hit: Hit) {
  const day = dayOf();
  const salt = await saltFor(day);
  const code = createHash("sha256").update(`${salt}|${hit.ip}|${hit.agent}`).digest("base64url").slice(0, 12);
  await changeDay(day, record => {
    const seen = record.seen || [];
    const fresh = !seen.includes(code);
    record.views++;
    bump(record.pages, hit.page);
    bump(record.products, hit.product);
    if (fresh) {
      record.visitors++;
      if (seen.length < 50_000) seen.push(code);
      bump(record.sources, hit.source);
      bump(record.devices, hit.device);
    }
    record.seen = seen;
    return record;
  });
}

/* Days from..to inclusive, oldest first, without the daily codes. */
export async function readDays(from: string, to: string): Promise<(Day & { day: string })[]> {
  const { blobs } = await stats().list({ prefix: "day/" });
  const keys = blobs.map(blob => blob.key.slice(4)).filter(day => day >= from && day <= to).sort();
  const days = await Promise.all(keys.map(async day => {
    const data = (await stats().get(`day/${day}`, { type: "json" })) as Day | null;
    if (!data) return null;
    const { seen, ...counts } = { ...blank(), ...data };
    return { day, ...counts };
  }));
  return days.filter(Boolean) as (Day & { day: string })[];
}
