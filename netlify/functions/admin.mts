import type { Config, Context } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import {
  shop, photos, readCatalog, writeCatalog, readSettings, listOrders, rowOf, upsertIndex,
  json, fail, text, whole, sameOrigin, TYPES, GIFT_TYPE, STATUSES, DEFAULT_SETTINGS, readBlog, writeBlog, type Post, trackUrl, type Product,
} from "../lib/store.mts";
import { sendStatusEmail, emailReady, EMAIL_STATUSES } from "../lib/mail.mts";
import { notifyRestocks, sendToWaitlist, readWaitlist, changeWaitlist, dropWaitlist, waitingCounts, onSale } from "../lib/restock.mts";
import { readDays, dayOf } from "../lib/stats.mts";
import { readOwner, signedIn, setup, login, changePassword, clearCookie } from "../lib/auth.mts";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

class Refuse extends Error { constructor(message: string, public status = 400) { super(message); } }

const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "piece";

/* Apply one change to the catalogue with a conditional write, retrying if an order or another tab saved first. */
async function changeCatalog<T>(change: (products: Product[]) => { products: Product[]; result: T }): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { products, etag } = await readCatalog();
    const next = change(products);
    if (await writeCatalog(next.products, etag)) return next.result;
  }
  throw new Refuse("The catalogue is busy. Try again in a moment.", 503);
}

async function dropUnused(ids: string[], products: Product[], posts?: Post[]) {
  const used = new Set([...products.flatMap(product => product.photos), ...(posts || (await readBlog()).posts).map(post => post.cover)]);
  await Promise.all(ids.filter(id => UUID.test(id) && !used.has(id)).map(id => photos().delete(id)));
}

async function saveProduct(body: any, origin: string) {
  const input = body?.product || {};
  const name = text(input.name, 120);
  const type = TYPES.includes(input.type) ? input.type : "";
  const published = input.published === true;
  if (!type) throw new Refuse("Choose a category.");
  if (!whole(input.price, 0, 999999999)) throw new Refuse("Enter the price in naira as a whole number.");
  if (!whole(input.stock, 0, 999999)) throw new Refuse("Enter how many you have in stock.");
  const sizes = Array.isArray(input.sizes) ? [...new Set(input.sizes.map((size: unknown) => text(size, 24)).filter(Boolean))].slice(0, 12) as string[] : [];
  /* Money bouquets and similar: the customer chooses the cash, the price is Zee's fee. Gift items only. */
  let cashMin: number | null = null;
  let cashMax: number | null = null;
  if (type === GIFT_TYPE && input.customCash === true) {
    if (!whole(input.cashMin, 0, 99999999)) throw new Refuse("Enter the smallest cash amount a customer can choose, in naira.");
    if (input.cashMax !== null && input.cashMax !== "" && input.cashMax !== undefined && (!whole(input.cashMax, 1, 99999999) || input.cashMax < input.cashMin)) {
      throw new Refuse("The largest cash amount must be more than the smallest.");
    }
    cashMin = input.cashMin;
    cashMax = whole(input.cashMax, 1, 99999999) ? input.cashMax : null;
  }
  const shots = Array.isArray(input.photos) ? [...new Set(input.photos.filter((photo: unknown) => typeof photo === "string"))] as string[] : [];
  if (shots.length > 12) throw new Refuse("A product can have up to 12 photos.");
  for (const photo of shots) {
    if (/^assets\/img\/[a-z0-9-]+\.(?:jpg|png|webp)$/.test(photo)) continue;
    if (!UUID.test(photo) || !(await photos().getMetadata(photo))) throw new Refuse("A photo is missing. Upload it again.");
  }

  let removed: string[] = [];
  let before: Product[] = [];
  const saved = await changeCatalog(products => {
    before = products;
    const existing = input.id ? products.find(product => product.id === input.id) : undefined;
    if (input.id && !existing) throw new Refuse("This product no longer exists. Reload the page.", 404);
    if (existing && existing.updatedAt !== input.updatedAt) throw new Refuse("This product was changed somewhere else. Reload it before saving.", 409);
    const members = type === "Combos" && Array.isArray(input.members)
      ? [...new Set(input.members.filter((id: unknown) => products.some(product => product.id === id && product.type !== "Combos" && product.type !== GIFT_TYPE && product.id !== input.id)))] as string[]
      : [];
    if (type === "Combos" && members.length < 2) throw new Refuse("Choose at least two pieces for this combo.");
    if (published && (!name || !input.price || (!shots.length && !members.length))) throw new Refuse("Add a name, a price and a photo before publishing.");
    if (!name && !existing) throw new Refuse("Give the product a name.");

    let id = existing?.id;
    if (!id) {
      const base = slug(name);
      id = base;
      for (let n = 2; products.some(product => product.id === id); n++) id = `${base}-${n}`;
    }
    /* Keep the live stock if the owner did not touch the field; an order may have lowered it meanwhile. */
    const stock = existing && input.stock === input.stockWas ? existing.stock : input.stock;
    const product: Product = {
      id, name: name || existing!.name, type, price: input.price, stock,
      description: text(input.description, 600), sizes, photos: shots, members, cashMin, cashMax,
      published, updatedAt: new Date().toISOString(),
    };
    removed = existing ? existing.photos.filter(photo => !shots.includes(photo)) : [];
    const next = existing ? products.map(item => item.id === id ? product : item) : [product, ...products];
    return { products: next, result: { product, products: next } };
  });
  await dropUnused(removed, saved.products);
  const restocked = await notifyRestocks(before, saved.products, origin);
  return { ...saved, restocked };
}

async function deleteProduct(id: string) {
  let removed: string[] = [];
  /* A deleted piece is taken out of any combo it was in. A combo left with fewer than
     two pieces is no longer a combo, so it is hidden from the store until the owner fixes it. */
  let trimmed: string[] = [];
  let hidden: string[] = [];
  const products = await changeCatalog(list => {
    const target = list.find(product => product.id === id);
    if (!target) throw new Refuse("This product no longer exists.", 404);
    removed = target.photos;
    trimmed = [];
    hidden = [];
    const next = list.filter(product => product.id !== id).map(product => {
      if (!product.members.includes(id)) return product;
      const members = product.members.filter(member => member !== id);
      const stillCombo = members.length >= 2;
      (stillCombo ? trimmed : hidden).push(product.name);
      return { ...product, members, published: stillCombo ? product.published : false, updatedAt: new Date().toISOString() };
    });
    return { products: next, result: next };
  });
  await dropUnused(removed, products);
  await dropWaitlist(id);
  return { products, trimmed, hidden };
}

async function uploadPhoto(req: Request) {
  const type = req.headers.get("content-type") || "";
  if (!PHOTO_TYPES.includes(type)) throw new Refuse("Choose a JPEG, PNG or WebP photo.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Refuse("That photo is too large. Photos can be up to 4 MB.");
  const head = String.fromCharCode(...bytes.slice(0, 12));
  const genuine = type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === "image/png" ? head.startsWith("\x89PNG")
    : head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
  if (!genuine) throw new Refuse("That file is not a photo this store can use.");
  const id = randomUUID();
  await photos().set(id, bytes.buffer as ArrayBuffer, { metadata: { type } });
  return { id };
}

async function updateOrder(body: any, origin: string) {
  const key = text(body?.key, 80);
  if (!/^orders\/\d+-GGZ-[A-F0-9]{6}$/.test(key)) throw new Refuse("That order could not be found.", 404);
  const entry = await shop().getWithMetadata(key, { type: "json" });
  if (entry === null) throw new Refuse("That order could not be found.", 404);
  const order: any = entry.data;

  /* Data deletion: remove everything that identifies the customer, keep what tax and accounting need
     (items, amounts, dates, status). Only for finished orders, so nothing in progress loses its address. */
  if (body.erase === true) {
    if (!["delivered", "cancelled"].includes(order.status)) throw new Refuse("You can erase a customer's details once the order is delivered or cancelled.", 409);
    if (!order.erasedAt) {
      order.customer = { name: "Erased customer", phone: "", email: "" };
      order.delivery = { ...order.delivery, address: "", city: "", lga: "", note: "" };
      order.gifts = order.gifts.map((gift: any) => ({ ...gift, note: "" }));
      order.note = "";
      order.emails = (order.emails || []).map((mail: any) => ({ ...mail, to: "" }));
      delete order.token;
      order.erasedAt = new Date().toISOString();
      const written = await shop().setJSON(key, order, { onlyIfMatch: entry.etag });
      if (!written.modified) throw new Refuse("This order was changed somewhere else. Reload it.", 409);
      await upsertIndex(rowOf(key, order));
    }
    return { order: { ...order, key, track: "" }, email: null };
  }
  if (order.erasedAt && (body.note !== undefined || body.resend)) throw new Refuse("This customer's details were erased.", 409);

  let changedTo = "";
  let restockedOnCancel: Awaited<ReturnType<typeof notifyRestocks>> = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new Refuse("That is not a status this store uses.");
    if (order.status === "cancelled" && body.status !== "cancelled") throw new Refuse("A cancelled order cannot be reopened. Ask the customer to order again.", 409);
    if (body.status === "cancelled" && !order.restocked) {
      const back = new Map<string, number>();
      for (const line of order.items) back.set(line.id, (back.get(line.id) || 0) + line.qty);
      for (const gift of order.gifts) for (const piece of gift.pieces) back.set(piece.id, (back.get(piece.id) || 0) + 1);
      let before: Product[] = [];
      const after = await changeCatalog(products => {
        before = products;
        const next = products.map(product => back.has(product.id) ? { ...product, stock: product.stock + back.get(product.id)! } : product);
        return { products: next, result: next };
      });
      order.restocked = true;
      restockedOnCancel = await notifyRestocks(before, after, origin);
    }
    if (order.status !== body.status) {
      order.history = [...(order.history?.length ? order.history : [{ status: "new", at: order.createdAt }]), { status: body.status, at: new Date().toISOString() }];
    }
    changedTo = order.status !== body.status ? body.status : "";
    order.status = body.status;
  }
  if (body.note !== undefined) order.note = text(body.note, 1000);
  const written = await shop().setJSON(key, order, { onlyIfMatch: entry.etag });
  if (!written.modified) throw new Refuse("This order was changed somewhere else. Reload it.", 409);
  await upsertIndex(rowOf(key, order));

  /* Email the customer when the order moves to paid, shipped or delivered, or when the owner asks to send again.
     The status change stands even if the email fails; the owner sees why and can resend. */
  const emailFor = changedTo || (body.resend === true ? order.status : "");
  let email: { sent: boolean; reason: string } | null = null;
  if (EMAIL_STATUSES.includes(emailFor)) {
    email = await sendStatusEmail(order, emailFor, origin, await readSettings());
    const record = { status: emailFor, at: new Date().toISOString(), sent: email.sent, reason: email.reason, to: order.customer.email || "" };
    for (let attempt = 0; attempt < 4; attempt++) {
      const latest = await shop().getWithMetadata(key, { type: "json" });
      if (!latest) break;
      const saved: any = latest.data;
      saved.emails = [...(saved.emails || []), record].slice(-20);
      if ((await shop().setJSON(key, saved, { onlyIfMatch: latest.etag })).modified) { order.emails = saved.emails; break; }
    }
  }
  return { order: { ...order, key, track: trackUrl(origin, order) }, email, restocked: restockedOnCancel };
}

/* ---------- blog ---------- */
async function changeBlog<T>(change: (posts: Post[]) => { posts: Post[]; result: T }): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { posts, etag, exists } = await readBlog();
    const next = change(posts);
    if (await writeBlog(next.posts, etag, exists)) return next.result;
  }
  throw new Refuse("The blog is busy. Try again in a moment.", 503);
}

async function savePost(body: any) {
  const input = body?.post || {};
  const title = text(input.title, 140);
  const postBody = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim().slice(0, 20000) : "";
  const cover = typeof input.cover === "string" ? input.cover : "";
  const published = input.published === true;
  if (!title) throw new Refuse("Give the post a title.");
  if (published && postBody.length < 20) throw new Refuse("Write the post before publishing it.");
  if (cover && (!UUID.test(cover) || !(await photos().getMetadata(cover)))) throw new Refuse("The cover photo is missing. Upload it again.");
  let dropped = "";
  const saved = await changeBlog(posts => {
    const existing = input.id ? posts.find(post => post.id === input.id) : undefined;
    if (input.id && !existing) throw new Refuse("This post no longer exists. Reload the page.", 404);
    if (existing && existing.updatedAt !== input.updatedAt) throw new Refuse("This post was changed somewhere else. Reload it before saving.", 409);
    let id = existing?.id;
    if (!id) {
      const base = slug(title);
      id = base;
      for (let n = 2; posts.some(post => post.id === id); n++) id = `${base}-${n}`;
    }
    const now = new Date().toISOString();
    const post: Post = {
      id, title, body: postBody, cover, excerpt: text(input.excerpt, 300), published,
      publishedAt: published ? (existing?.published ? existing.publishedAt : now) : (existing?.publishedAt || ""),
      updatedAt: now,
    };
    dropped = existing && existing.cover !== cover ? existing.cover : "";
    const next = existing ? posts.map(item => item.id === id ? post : item) : [post, ...posts];
    return { posts: next, result: { post, posts: next } };
  });
  if (dropped) await dropUnused([dropped], (await readCatalog()).products, saved.posts);
  return saved;
}

async function deletePost(id: string) {
  let cover = "";
  const posts = await changeBlog(list => {
    const target = list.find(post => post.id === id);
    if (!target) throw new Refuse("This post no longer exists.", 404);
    cover = target.cover;
    const next = list.filter(post => post.id !== id);
    return { posts: next, result: next };
  });
  if (cover) await dropUnused([cover], (await readCatalog()).products, posts);
  return { posts };
}

async function saveSettings(body: any) {
  const input = body?.settings || {};
  const next = structuredClone(DEFAULT_SETTINGS);
  const sale = input.sale || {};
  const start = Date.parse(sale.start);
  const end = Date.parse(sale.end);
  if (sale.enabled) {
    if (!text(sale.name, 60)) throw new Refuse("Give the sale a name.");
    if (!whole(sale.percent, 1, 90)) throw new Refuse("The discount must be between 1 and 90 percent.");
    if (!start || !end || end <= start) throw new Refuse("The sale must end after it starts.");
  }
  next.sale = {
    enabled: sale.enabled === true, name: text(sale.name, 60),
    start: start ? new Date(start).toISOString() : next.sale.start,
    end: end ? new Date(end).toISOString() : next.sale.end,
    percent: whole(sale.percent, 0, 90) ? sale.percent : 0,
    giftOver: whole(sale.giftOver, 0, 999999999) ? sale.giftOver : 0,
  };
  const fee = (value: unknown) => (value === null || value === "" || value === undefined ? null : value);
  for (const zone of ["lagos", "other"] as const) {
    const value = fee(input.delivery?.[zone]);
    if (value !== null && !whole(value, 0, 9999999)) throw new Refuse("Delivery fees must be whole naira amounts, or left empty.");
    next.delivery[zone] = value as number | null;
  }
  const account = text(input.bank?.accountNumber, 20).replace(/\s/g, "");
  if (account && !/^\d{10}$/.test(account)) throw new Refuse("A Nigerian account number has 10 digits.");
  next.bank = { bankName: text(input.bank?.bankName, 60), accountName: text(input.bank?.accountName, 80), accountNumber: account };
  if (account && (!next.bank.bankName || !next.bank.accountName)) throw new Refuse("Add the bank name and account name too.");
  const whatsapp = text(input.contact?.whatsapp, 20).replace(/[^\d]/g, "").replace(/^0/, "234");
  if (!/^234[789][01]\d{8}$/.test(whatsapp)) throw new Refuse("Enter the WhatsApp number, like 0907 274 7685.");
  next.contact = {
    whatsapp,
    tiktok: text(input.contact?.tiktok, 40).replace(/^@/, "").replace(/[^\w.]/g, ""),
    snapchat: text(input.contact?.snapchat, 40).replace(/[^\w.-]/g, ""),
  };
  next.policies = { delivery: text(input.policies?.delivery, 1500), returns: text(input.policies?.returns, 1500) };
  const fromAddress = text(input.email?.fromAddress, 120).toLowerCase();
  if (fromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) throw new Refuse("The address emails come from looks incomplete.");
  /* Resend only sends from domains verified in it; free mailboxes can never be verified. */
  if (/@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|aol|proton|protonmail)\./.test(fromAddress)) {
    throw new Refuse("Emails must come from an address on your own domain, like orders@glossygemzbyzee.com. Put your Gmail address under \"Replies go to\" instead.");
  }
  const replyTo = text(input.email?.replyTo, 120).toLowerCase();
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new Refuse("The address replies go to looks incomplete.");
  const alertTo = text(input.email?.alertTo, 120).toLowerCase();
  if (alertTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertTo)) throw new Refuse("The address for new order alerts looks incomplete.");
  const stockAlertAt = input.email?.stockAlertAt === null || input.email?.stockAlertAt === "" || input.email?.stockAlertAt === undefined ? null : input.email.stockAlertAt;
  if (stockAlertAt !== null && !whole(stockAlertAt, 0, 999)) throw new Refuse("The stock alert level must be a whole number, or empty to turn it off.");
  next.email = { fromAddress, fromName: text(input.email?.fromName, 60) || "Glossy Gems by Zee", replyTo, alertTo, stockAlertAt };
  await shop().setJSON("settings", next);
  return { settings: next, email: emailReady(next) };
}

/* The Visitors page: one row per day for the chosen period (empty days included),
   the same totals for the period before it, and what people looked at. */
async function visitorReport(span: number) {
  const today = dayOf();
  const dayAt = (back: number) => dayOf(Date.now() - back * 86400_000);
  const from = dayAt(span - 1);
  const before = dayAt(span * 2 - 1);
  const [records, orders, { products }] = await Promise.all([readDays(before, today), listOrders(), readCatalog()]);
  const ordersOn = new Map<string, number>();
  for (const order of orders) { const day = dayOf(order.createdAt); ordersOn.set(day, (ordersOn.get(day) || 0) + 1); }

  const byDay = new Map(records.map(record => [record.day, record]));
  const days = Array.from({ length: span }, (_, index) => {
    const day = dayAt(span - 1 - index);
    const record = byDay.get(day);
    return { day, visitors: record?.visitors || 0, views: record?.views || 0, orders: ordersOn.get(day) || 0 };
  });
  const sum = (rows: { visitors: number; views: number; orders: number }[]) =>
    rows.reduce((total, row) => ({ visitors: total.visitors + row.visitors, views: total.views + row.views, orders: total.orders + row.orders }), { visitors: 0, views: 0, orders: 0 });
  const earlier = records.filter(record => record.day < from).map(record => ({ ...record, orders: 0 }));
  for (const [day, count] of ordersOn) if (day >= before && day < from) earlier.push({ day, visitors: 0, views: 0, orders: count } as any);

  const inRange = records.filter(record => record.day >= from);
  const merge = (pick: (record: typeof records[number]) => Record<string, number>, limit: number) => {
    const totals = new Map<string, number>();
    for (const record of inRange) for (const [key, count] of Object.entries(pick(record) || {})) totals.set(key, (totals.get(key) || 0) + count);
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key, count]) => ({ key, count }));
  };
  const names = new Map(products.map(product => [product.id, product.name]));
  return {
    today, span, days,
    totals: sum(days), previous: sum(earlier),
    pages: merge(record => record.pages, 10),
    products: merge(record => record.products, 10).map(row => ({ ...row, name: names.get(row.key) || "" })),
    sources: merge(record => record.sources, 10),
    devices: merge(record => record.devices, 3),
  };
}

export default async (req: Request, context: Context) => {
  const route = context.params[0] || "";
  const get = req.method === "GET";
  try {
    if (!get && !sameOrigin(req)) return fail("This request did not come from the dashboard.", 403);
    const body = !get && route !== "photos" && req.method !== "DELETE" ? await req.json().catch(() => ({})) : {};

    if (route === "session" && get) {
      const [owner, current] = await Promise.all([readOwner(), signedIn(req)]);
      return json({ setupNeeded: !owner, signedIn: Boolean(current), email: current?.email || "" });
    }
    if (route === "setup" || route === "login") {
      const result: any = route === "setup"
        ? await setup(req, text(body.email, 120), body.password, body.code)
        : await login(req, body.email, body.password);
      return result.error ? fail(result.error, 401) : json({ email: result.email }, 200, { "Set-Cookie": result.cookie });
    }
    if (route === "logout") return json({ ok: true }, 200, { "Set-Cookie": clearCookie });

    const owner = await signedIn(req);
    if (!owner) return fail("Sign in to manage the store.", 401);

    if (route === "password") {
      const result: any = await changePassword(req, owner, body.current, body.next);
      return result.error ? fail(result.error) : json({ ok: true }, 200, { "Set-Cookie": result.cookie });
    }
    if (route === "products" && get) return json({ products: (await readCatalog()).products });
    if (route === "products" && req.method === "POST") return json(await saveProduct(body, new URL(req.url).origin));
    if (route === "waiting" && get) {
      const id = new URL(req.url).searchParams.get("id");
      return json(id ? { list: await readWaitlist(id) } : { counts: await waitingCounts() });
    }
    if (route === "waiting" && req.method === "POST") {
      const id = text(body.id, 80);
      if (body.remove) {
        const email = text(body.remove, 120).toLowerCase();
        return json({ list: await changeWaitlist(id, list => list.filter(entry => entry.email !== email)) });
      }
      if (body.send === true) {
        const { products } = await readCatalog();
        const product = products.find(item => item.id === id);
        if (!product) throw new Refuse("This product no longer exists.", 404);
        if (!onSale(product, products)) throw new Refuse("Put it back in stock and show it in the store before emailing the waiting list.", 409);
        return json({ result: await sendToWaitlist(product, new URL(req.url).origin), list: await readWaitlist(id) });
      }
      throw new Refuse("Nothing to do.");
    }
    if (route.startsWith("products/") && req.method === "DELETE") return json(await deleteProduct(decodeURIComponent(route.slice(9))));
    if (route === "photos" && req.method === "POST") return json(await uploadPhoto(req), 201);
    if (route === "orders" && get) return json({ orders: await listOrders() });
    if (route === "visitors" && get) {
      const span = Number(new URL(req.url).searchParams.get("days"));
      return json(await visitorReport([7, 30, 90].includes(span) ? span : 30));
    }
    if (route === "order" && get) {
      const key = new URL(req.url).searchParams.get("key") || "";
      const order = /^orders\/\d+-GGZ-[A-F0-9]{6}$/.test(key) ? await shop().get(key, { type: "json" }) : null;
      if (!order) return fail("That order could not be found.", 404);
      const origin = new URL(req.url).origin;
      return json({ order: { ...order, key, track: trackUrl(origin, order as any) }, email: emailReady(await readSettings()) });
    }
    if (route === "order" && req.method === "POST") return json(await updateOrder(body, new URL(req.url).origin));
    if (route === "posts" && get) return json({ posts: (await readBlog()).posts });
    if (route === "posts" && req.method === "POST") return json(await savePost(body));
    if (route.startsWith("posts/") && req.method === "DELETE") return json(await deletePost(decodeURIComponent(route.slice(6))));
    if (route === "settings" && get) { const settings = await readSettings(); return json({ settings, email: emailReady(settings) }); }
    if (route === "settings" && req.method === "POST") return json(await saveSettings(body));
    return fail("Not found.", 404);
  } catch (error) {
    if (error instanceof Refuse) return fail(error.message, error.status);
    console.error("admin", route, error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
};

export const config: Config = {
  path: "/api/admin/*",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 240 },
};
