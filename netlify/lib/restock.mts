import { shop, readSettings, sellable, type Product } from "./store.mts";
import { sendRestockEmails } from "./mail.mts";

/* Back-in-stock requests. Each sold-out product has its own list under "restock/<product id>".
   An address is used for one email only: it is removed as soon as that email is sent,
   and the whole list goes when the product is deleted. */

export type Waiting = { email: string; at: string };
const keyFor = (id: string) => `restock/${id}`;

export async function readWaitlist(id: string): Promise<Waiting[]> {
  const list = (await shop().get(keyFor(id), { type: "json" })) as Waiting[] | null;
  return Array.isArray(list) ? list : [];
}

/* Conditional read-modify-write, retrying if someone else changed the list first. */
export async function changeWaitlist(id: string, change: (list: Waiting[]) => Waiting[]) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const entry = await shop().getWithMetadata(keyFor(id), { type: "json" });
    const list = entry && Array.isArray(entry.data) ? (entry.data as Waiting[]) : [];
    const next = change(list);
    if (!next.length) {
      if (entry) await shop().delete(keyFor(id));
      return next;
    }
    const options = entry?.etag ? { onlyIfMatch: entry.etag } : entry ? {} : { onlyIfNew: true };
    if ((await shop().setJSON(keyFor(id), next, options)).modified) return next;
  }
  throw new Error("The waiting list is busy. Try again in a moment.");
}

export const dropWaitlist = (id: string) => shop().delete(keyFor(id));

export async function waitingCounts(): Promise<Record<string, number>> {
  const { blobs } = await shop().list({ prefix: "restock/" });
  const counts: Record<string, number> = {};
  for (const blob of blobs) {
    const list = (await shop().get(blob.key, { type: "json" })) as Waiting[] | null;
    if (Array.isArray(list) && list.length) counts[blob.key.slice("restock/".length)] = list.length;
  }
  return counts;
}

export const onSale = (product: Product | undefined, all: Product[]) => Boolean(product && product.published && sellable(product, all) > 0);

/* Email everyone waiting for this product, then forget the addresses that were sent to. */
export async function sendToWaitlist(product: Product, origin: string) {
  const list = await readWaitlist(product.id);
  if (!list.length) return { id: product.id, name: product.name, sent: 0, left: 0, reason: "" };
  const result = await sendRestockEmails(product, list.map(entry => entry.email), origin, await readSettings());
  const sent = new Set(result.sent);
  const left = await changeWaitlist(product.id, current => current.filter(entry => !sent.has(entry.email)));
  return { id: product.id, name: product.name, sent: sent.size, left: left.length, reason: result.reason };
}

/* After any change to the catalogue: whatever just came back on sale gets its waiting list emailed.
   This includes a combo that becomes available again because one of its pieces was restocked. */
export async function notifyRestocks(before: Product[], after: Product[], origin: string) {
  const back = after.filter(product => onSale(product, after) && !onSale(before.find(item => item.id === product.id), before));
  const results = [];
  for (const product of back) {
    const outcome = await sendToWaitlist(product, origin);
    if (outcome.sent || outcome.left) results.push(outcome);
  }
  return results;
}
