import type { Config, Context } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import {
  shop, readCatalog, writeCatalog, readSettings, saleNow, rowOf, upsertIndex,
  json, fail, text, whole, sameOrigin, sellable, type Product,
} from "../lib/store.mts";
import { LGAS } from "../lib/lgas.mts";
import { sendOrderAlert, sendStockAlert } from "../lib/mail.mts";

class Refuse extends Error {}

const GIFT_TYPE = "Gift items";
const naira = (amount: number) => "₦" + amount.toLocaleString("en-NG");

/* Prices, stock and discounts are always worked out here from the saved catalogue.
   Nothing the browser says about money is trusted. */
function price(body: any, products: Product[]) {
  const live = new Map(products.filter(product => product.published).map(product => [product.id, product]));
  const need = new Map<string, number>();
  const want = (id: unknown, size: unknown, qty: number, inGift = false, cash: unknown = 0) => {
    const product = live.get(String(id));
    if (!product) throw new Refuse("A piece in your bag is no longer available. Remove it and try again.");
    /* Gift items (flowers, money bouquets...) can only be ordered inside a Gift Builder package. */
    if (product.type === GIFT_TYPE && !inGift) throw new Refuse(`The ${product.name} is only available in the Gift Builder.`);
    const chosen = text(size, 12);
    if (product.sizes.length && !product.sizes.includes(chosen)) throw new Refuse(`Choose an option for the ${product.name}.`);
    /* Money bouquets: the customer chooses the cash; the listed price is the bouquet fee. */
    let amount = 0;
    if (product.type === GIFT_TYPE && product.cashMin != null) {
      const max = product.cashMax || 5000000;
      if (!whole(cash, 1, max) || (cash as number) < product.cashMin) {
        throw new Refuse(`Choose between ${naira(Math.max(1, product.cashMin))} and ${naira(max)} in cash for the ${product.name}.`);
      }
      amount = cash as number;
    }
    need.set(product.id, (need.get(product.id) || 0) + qty);
    return { id: product.id, name: product.name, size: product.sizes.length ? chosen : "", price: product.price + amount, ...(amount ? { cash: amount, fee: product.price } : {}) };
  };

  if (!Array.isArray(body.items) || !Array.isArray(body.gifts) || body.items.length > 40 || body.gifts.length > 10) {
    throw new Refuse("Your bag could not be read. Refresh the page and try again.");
  }
  const items = body.items.map((line: any) => {
    if (!whole(line?.qty, 1, 99)) throw new Refuse("A quantity in your bag is not valid.");
    return { ...want(line.id, line.size, line.qty), qty: line.qty };
  });
  const gifts = body.gifts.map((gift: any) => {
    if (!Array.isArray(gift?.pieces) || !gift.pieces.length || gift.pieces.length > 12) throw new Refuse("A gift in your bag is empty.");
    return { pieces: gift.pieces.map((piece: any) => want(piece?.id, piece?.size, 1, true, piece?.cash)), note: text(gift.note, 200) };
  });
  if (!items.length && !gifts.length) throw new Refuse("Your bag is empty.");

  for (const [id, qty] of need) {
    const product = live.get(id)!;
    if (product.stock < qty) {
      throw new Refuse(product.stock ? `Only ${product.stock} of the ${product.name} left. Lower the quantity and try again.` : `The ${product.name} has just sold out.`);
    }
    if (product.members?.length && sellable(product, products) < 1) {
      const gone = product.members.map(member => live.get(member)).find(piece => !piece || piece.stock < 1);
      throw new Refuse(`The ${product.name} is sold out${gone ? ` because the ${gone.name} has sold out` : ""}.`);
    }
  }
  const subtotal = items.reduce((sum: number, line: any) => sum + line.price * line.qty, 0) +
    gifts.reduce((sum: number, gift: any) => sum + gift.pieces.reduce((inner: number, piece: any) => inner + piece.price, 0), 0);
  return { items, gifts, subtotal, need };
}

export default async (req: Request, context: Context) => {
  if (!sameOrigin(req)) return fail("This request did not come from the store.", 403);
  let body: any;
  try { body = await req.json(); } catch { return fail("Your order could not be read. Refresh the page and try again."); }

  const customer = { name: text(body?.name, 80), phone: text(body?.phone, 20).replace(/[\s-]/g, ""), email: text(body?.email, 120) };
  const delivery = { address: text(body?.address, 200), city: text(body?.city, 60), lga: text(body?.lga, 60), state: text(body?.state, 30), note: text(body?.note, 300) };
  if (customer.name.length < 2) return fail("Enter your name.");
  if (!/^(?:\+?234|0)[789][01]\d{8}$/.test(customer.phone)) return fail("Enter a Nigerian mobile number, like 0803 123 4567.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return fail(customer.email ? "That email looks incomplete." : "Enter your email so we can confirm your order.");
  if (delivery.address.length < 6 || !delivery.city) return fail("Enter the full delivery address.");
  if (body?.agree !== true) return fail("Tick the box to agree to the terms before placing your order.");
  if (!Object.hasOwn(LGAS, delivery.state)) return fail("Choose the state to deliver to.");
  if (!LGAS[delivery.state].includes(delivery.lga)) return fail("Choose the local government area to deliver to.");

  const settings = await readSettings();
  let priced: ReturnType<typeof price> | undefined;
  let before: Product[] = [];
  try {
    /* Take the stock and save the catalogue in one conditional write; retry if someone else saved first. */
    for (let attempt = 0; attempt < 5 && !priced; attempt++) {
      const { products, etag } = await readCatalog();
      const result = price(body, products);
      const next = products.map(product => result.need.has(product.id) ? { ...product, stock: product.stock - result.need.get(product.id)! } : product);
      if (await writeCatalog(next, etag)) { priced = result; before = products; }
    }
  } catch (error) {
    if (error instanceof Refuse) return fail(error.message, 409);
    throw error;
  }
  if (!priced) return fail("The store is busy right now. Wait a moment and try again.", 503);

  const active = saleNow(settings) === "active";
  const discount = active ? priced.subtotal - Math.round(priced.subtotal * (100 - settings.sale.percent) / 100) : 0;
  const fee = delivery.state === "Lagos" ? settings.delivery.lagos : settings.delivery.other;
  const afterDiscount = priced.subtotal - discount;
  const createdAt = new Date().toISOString();
  const order = {
    ref: "GGZ-" + randomBytes(4).toString("hex").slice(0, 6).toUpperCase(),
    token: randomBytes(16).toString("hex"),
    consent: { terms: "2026-11-17", at: createdAt },
    createdAt, status: "new", history: [{ status: "new", at: createdAt }], emails: [] as unknown[], customer,
    delivery: { ...delivery, fee },
    items: priced.items, gifts: priced.gifts,
    subtotal: priced.subtotal, discount, saleName: discount ? settings.sale.name : "",
    freeGift: active && afterDiscount > settings.sale.giftOver,
    total: afterDiscount + (fee || 0),
    note: "", restocked: false,
  };
  const key = `orders/${createdAt.replace(/[^0-9]/g, "")}-${order.ref}`;
  await shop().setJSON(key, order);
  await shop().setJSON(`refs/${order.ref}`, { key });
  await upsertIndex(rowOf(key, order));

  /* Tell the owner about the new order. Sent after the response so checkout never waits on email,
     and a failed alert never fails the order. */
  const origin = new URL(req.url).origin;
  const quietly = (label: string) => (result: { sent: boolean; reason: string }) => {
    if (!result.sent && result.reason && !/off|not switched on/.test(result.reason)) console.error(label, order.ref, result.reason);
  };
  /* Stock alert: pieces this order took to the owner's threshold or below (sold out by default). */
  const threshold = settings.email.stockAlertAt;
  const low = threshold === null || threshold === undefined ? [] : [...priced.need].map(([id, qty]) => {
    const product = before.find(item => item.id === id)!;
    return { id, name: product.name, was: product.stock, left: product.stock - qty };
  }).filter(item => item.was > threshold && item.left <= threshold);
  const alerts = Promise.all([
    sendOrderAlert(order, key, origin, settings).then(quietly("order alert")),
    low.length ? sendStockAlert(low, order.ref, origin, settings).then(quietly("stock alert")) : null,
  ]).catch(error => console.error("alerts", order.ref, error));
  if (typeof context?.waitUntil === "function") context.waitUntil(alerts); else await alerts;

  const { note, restocked, emails, ...receipt } = order;
  return json({ order: receipt, bank: settings.bank.accountNumber ? settings.bank : null }, 201);
};

export const config: Config = {
  path: "/api/orders",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 8 },
};
