import type { Config } from "@netlify/functions";
import { readCatalog, sellable, json, fail, text, sameOrigin } from "../lib/store.mts";
import { changeWaitlist } from "../lib/restock.mts";

/* POST /api/restock { id, email }: ask to be emailed once when a sold-out piece is back. */
export default async (req: Request) => {
  if (!sameOrigin(req)) return fail("This request did not come from the store.", 403);
  const body = await req.json().catch(() => ({}));
  const id = text(body?.id, 80);
  const email = text(body?.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const { products } = await readCatalog();
  const product = products.find(item => item.id === id && item.published);
  if (!product) return fail("That piece isn't available any more.", 404);
  if (sellable(product, products) > 0) return fail("Good news: it's back in stock. Refresh the page to order it.", 409);
  const list = await changeWaitlist(product.id, current =>
    current.some(entry => entry.email === email) || current.length >= 1000 ? current : [...current, { email, at: new Date().toISOString() }]);
  if (!list.some(entry => entry.email === email)) return fail("This list is full. Message Zee on WhatsApp instead.", 409);
  return json({ ok: true });
};

export const config: Config = {
  path: "/api/restock",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
};
