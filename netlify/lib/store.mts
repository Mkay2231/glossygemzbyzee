import { getStore } from "@netlify/blobs";

/* All shop data lives in Netlify Blobs with strong consistency.
   Keys: "catalog", "settings", "owner", "secret", "orders-index", "orders/<stamp>-<ref>".
   Photos live in their own store, keyed by a random id. */

export const TYPES = ["Earrings", "Necklaces", "Bracelets", "Rings", "Lip Gloss", "Combos", "Gift items"];
export const GIFT_TYPE = "Gift items";
export const STATUSES = ["new", "paid", "shipped", "delivered", "cancelled"];

export const shop = () => getStore({ name: "shop", consistency: "strong" });
export const photos = () => getStore({ name: "photos", consistency: "strong" });

export type Product = {
  id: string; name: string; type: string; price: number; stock: number;
  description: string; sizes: string[]; photos: string[]; members: string[];
  /* Gift items only: when set, the customer chooses how much cash goes in (money bouquets) and price is the fee. */
  cashMin?: number | null; cashMax?: number | null;
  published: boolean; sample?: boolean; updatedAt: string;
};

const SAMPLE: Array<Partial<Product>> = [
  { id: "sola-hoops", name: "Sola Hoops", type: "Earrings", price: 14500, photos: ["assets/img/sola-hoops.jpg"],
    description: "Chunky rounded hoops with a mirror shine. The pair to reach for when an outfit needs one bold thing." },
  { id: "pearl-drop-necklace", name: "Pearl Drop Necklace", type: "Necklaces", price: 18000, photos: ["assets/img/pearl-drop-necklace.jpg"],
    description: "A fine link chain carrying a single pearl drop. Quiet on its own, lovely under a longer layer." },
  { id: "dune-cuff", name: "Dune Cuff", type: "Bracelets", price: 16500, photos: ["assets/img/dune-cuff.jpg"],
    description: "An open cuff with a soft wave through it, shaped like the line of a dune." },
  { id: "lumi-dome-ring", name: "Lumi Dome Ring", type: "Rings", price: 12500, photos: ["assets/img/lumi-dome-ring.jpg"], sizes: ["6", "7", "8", "9"],
    description: "A smooth high-dome ring with a mirror finish. Big enough to wear alone." },
  { id: "fine-line-bracelet", name: "Fine Line Bracelet", type: "Bracelets", price: 11500, photos: ["assets/img/fine-line-bracelet.jpg"],
    description: "A fine chain dotted with tiny beads, closed with a lobster clasp. Made for stacking." },
  { id: "chain-cuff-ring-set", name: "Chain, Cuff & Ring Set", type: "Combos", price: 47000,
    members: ["pearl-drop-necklace", "dune-cuff", "lumi-dome-ring"],
    description: "Three pieces that already go together: the pearl drop, the wave cuff and the dome ring." },
  { id: "hoops-fine-bracelet-set", name: "Hoops & Fine Bracelet Set", type: "Combos", price: 26000,
    members: ["sola-hoops", "fine-line-bracelet"],
    description: "The bold hoops with the fine beaded bracelet. One statement, one whisper." },
];

export const DEFAULT_SETTINGS = {
  sale: {
    enabled: true,
    name: "2nd Anniversary Ember Sales",
    start: "2026-11-20T00:00:00+01:00",
    end: "2026-11-30T23:59:59+01:00",
    percent: 20,
    giftOver: 10000,
  },
  delivery: { lagos: null as number | null, other: null as number | null },
  bank: { bankName: "", accountName: "", accountNumber: "" },
  contact: { whatsapp: "2349072747685", tiktok: "glossygems.by.zee", snapchat: "zhannie_xoxo" },
  policies: { delivery: "", returns: "" },
  /* Customer emails go through Resend. The address must be on a domain verified in Resend;
     the API key lives only in the RESEND_API_KEY environment variable. */
  email: { fromAddress: "", fromName: "Glossy Gems by Zee", replyTo: "glossygemzbyzee@gmail.com", alertTo: "glossygemzbyzee@gmail.com" },
};
export type Settings = typeof DEFAULT_SETTINGS;

export async function readCatalog(): Promise<{ products: Product[]; etag?: string }> {
  const entry = await shop().getWithMetadata("catalog", { type: "json" });
  if (entry === null) {
    const now = new Date().toISOString();
    const products = SAMPLE.map(item => ({
      stock: 10, sizes: [], photos: [], members: [], published: true, sample: true, updatedAt: now, ...item,
    })) as Product[];
    const written = await shop().setJSON("catalog", { products }, { onlyIfNew: true });
    if (written.modified) return { products, etag: written.etag };
    return readCatalog();
  }
  return { products: (entry.data as { products: Product[] }).products, etag: entry.etag };
}

/* Conditional write: returns false when someone else saved first. */
export async function writeCatalog(products: Product[], etag?: string): Promise<boolean> {
  const result = await shop().setJSON("catalog", { products }, etag ? { onlyIfMatch: etag } : {});
  return result.modified;
}

export async function readSettings(): Promise<Settings> {
  const saved = (await shop().get("settings", { type: "json" })) as Partial<Settings> | null;
  const merged: any = structuredClone(DEFAULT_SETTINGS);
  for (const key of Object.keys(merged)) Object.assign(merged[key], (saved as any)?.[key] || {});
  return merged;
}

export function saleNow(settings: Settings, now = Date.now()) {
  const sale = settings.sale;
  if (!sale.enabled || !sale.percent) return "over";
  if (now < Date.parse(sale.start)) return "upcoming";
  return now <= Date.parse(sale.end) ? "active" : "over";
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
export const fail = (message: string, status = 400) => json({ error: message }, status);

export const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
export const whole = (value: unknown, min: number, max: number) =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

/* ---------- order tracking ---------- */
/* Each order has a random token; the tracking link is the order reference plus that token.
   "refs/<ref>" points from the reference to where the order is stored. */
export const trackUrl = (origin: string, order: { ref: string; token?: string }) =>
  order.token ? `${origin}/order.html?ref=${encodeURIComponent(order.ref)}&t=${order.token}` : "";

export async function orderByRef(ref: string): Promise<{ key: string; order: any } | null> {
  if (!/^GGZ-[A-F0-9]{6}$/.test(ref)) return null;
  const pointer = (await shop().get(`refs/${ref}`, { type: "json" })) as { key: string } | null;
  const key = pointer?.key || (await shop().list({ prefix: "orders/" })).blobs.find(blob => blob.key.endsWith("-" + ref))?.key;
  if (!key) return null;
  const order = await shop().get(key, { type: "json" });
  return order ? { key, order } : null;
}

/* What a customer may see about their own order. Never includes the owner's notes. */
export function publicOrder(order: any) {
  const history = order.history?.length ? order.history : [{ status: "new", at: order.createdAt }];
  return {
    ref: order.ref, createdAt: order.createdAt, status: order.status, history,
    customer: { name: order.customer.name.split(/\s+/)[0] },
    items: order.items, gifts: order.gifts,
    subtotal: order.subtotal, discount: order.discount, saleName: order.saleName, freeGift: order.freeGift,
    total: order.total, delivery: { ...order.delivery, note: undefined },
  };
}

/* ---------- order index ---------- */
export type OrderRow = { key: string; ref: string; createdAt: string; status: string; name: string; phone: string; total: number; pieces: number };

export const rowOf = (key: string, order: any): OrderRow => ({
  key, ref: order.ref, createdAt: order.createdAt, status: order.status,
  name: order.customer.name, phone: order.customer.phone, total: order.total,
  pieces: order.items.reduce((sum: number, item: any) => sum + item.qty, 0) + order.gifts.length,
});

export async function upsertIndex(row: OrderRow) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const entry = await shop().getWithMetadata("orders-index", { type: "json" });
    const rows: OrderRow[] = entry ? (entry.data as OrderRow[]) : [];
    const next = [row, ...rows.filter(item => item.key !== row.key)];
    const result = await shop().setJSON("orders-index", next, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
    if (result.modified) return;
  }
}

/* The index is a convenience. If it ever misses an order, rebuild that row from the order itself. */
export async function listOrders(): Promise<OrderRow[]> {
  const [{ blobs }, saved] = await Promise.all([
    shop().list({ prefix: "orders/" }),
    shop().get("orders-index", { type: "json" }) as Promise<OrderRow[] | null>,
  ]);
  const known = new Map((saved || []).map(row => [row.key, row]));
  const missing = blobs.filter(blob => !known.has(blob.key));
  for (const blob of missing) {
    const order = await shop().get(blob.key, { type: "json" });
    if (order) { const row = rowOf(blob.key, order); known.set(blob.key, row); await upsertIndex(row); }
  }
  const keys = new Set(blobs.map(blob => blob.key));
  return [...known.values()].filter(row => keys.has(row.key)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- blog ---------- */
export type Post = {
  id: string; title: string; excerpt: string; body: string; cover: string;
  published: boolean; publishedAt: string; updatedAt: string;
};

/* `exists` is tracked separately from the etag: some stores (the local dev one) return entries without an etag. */
export async function readBlog(): Promise<{ posts: Post[]; etag?: string; exists: boolean }> {
  const entry = await shop().getWithMetadata("blog", { type: "json" });
  return entry ? { posts: (entry.data as { posts: Post[] }).posts, etag: entry.etag, exists: true } : { posts: [], exists: false };
}

export async function writeBlog(posts: Post[], etag: string | undefined, exists: boolean) {
  const result = await shop().setJSON("blog", { posts }, etag ? { onlyIfMatch: etag } : exists ? {} : { onlyIfNew: true });
  return result.modified;
}

/* The short text shown on blog cards: the owner's own excerpt, or the start of the post. */
export function excerptOf(post: Post) {
  if (post.excerpt) return post.excerpt;
  /* Plain paragraphs only: no subheadings, lists, or paragraphs with web links (they read badly cut short). */
  const prose = post.body.split(/\n{2,}/).map(block => block.trim())
    .filter(block => block && !block.startsWith("## ") && !block.split("\n").every(line => line.startsWith("- ")));
  const plain = prose.filter(block => !/https?:\/\//.test(block));
  const paragraphs = (plain.length ? plain : prose).map(block => block.replace(/\s+/g, " ").trim());
  let text = "";
  for (const paragraph of paragraphs) {
    text = text ? `${text} ${paragraph}` : paragraph;
    if (text.length >= 90) break;
  }
  return text.length > 180 ? text.slice(0, 180).replace(/\s\S*$/, "") + "…" : text;
}
