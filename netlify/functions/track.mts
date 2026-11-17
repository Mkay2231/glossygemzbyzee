import type { Config } from "@netlify/functions";
import { timingSafeEqual } from "node:crypto";
import { orderByRef, publicOrder, readSettings, json, fail, text, sameOrigin } from "../lib/store.mts";

/* A customer's view of their own order.
   GET  /api/track?ref=GGZ-XXXXXX&t=<token>   from the link on the confirmation page and in emails
   POST /api/track { ref, phone }             for a customer who lost the link */

const same = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const digits = (phone: string) => phone.replace(/\D/g, "").replace(/^234/, "0");
const notFound = () => fail("We couldn't find that order. Check the order number and phone number, or message Zee on WhatsApp.", 404);

export default async (req: Request) => {
  let ref = "";
  let proof = (_order: any) => false;
  if (req.method === "GET") {
    const url = new URL(req.url);
    ref = text(url.searchParams.get("ref"), 12).toUpperCase();
    const token = text(url.searchParams.get("t"), 64);
    proof = order => Boolean(order.token && token && same(order.token, token));
  } else {
    if (!sameOrigin(req)) return fail("This request did not come from the store.", 403);
    const body = await req.json().catch(() => ({}));
    ref = text(body?.ref, 12).toUpperCase().replace(/^(?!GGZ-)/, "GGZ-");
    const phone = digits(text(body?.phone, 20));
    proof = order => phone.length >= 10 && same(digits(order.customer.phone), phone);
  }
  const found = await orderByRef(ref);
  if (!found || !proof(found.order)) return notFound();
  const settings = await readSettings();
  return json({
    order: publicOrder(found.order),
    token: found.order.token || "",
    bank: found.order.status === "new" && settings.bank.accountNumber ? settings.bank : null,
    whatsapp: settings.contact.whatsapp,
  });
};

export const config: Config = {
  path: "/api/track",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
