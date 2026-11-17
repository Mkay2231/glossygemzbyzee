import { getStore } from "@netlify/blobs";
import { trackUrl, type Settings } from "./store.mts";

/* Customer status emails, sent through Resend (https://resend.com).
   Switched on when RESEND_API_KEY is set on the site and a sender address on a domain verified in Resend
   is saved in Settings. Replies go to the "Replies go to" address, because the sending address has no inbox.
   For local testing only, EMAIL_OUTBOX=local stores the email in a local blob store instead of sending it. */

export const EMAIL_STATUSES = ["paid", "shipped", "delivered"];

const money = (amount: number) => "₦" + Math.round(amount || 0).toLocaleString("en-NG");
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const COPY: Record<string, { subject: (ref: string) => string; heading: string; body: string }> = {
  paid: {
    subject: ref => `Payment confirmed for your order ${ref}`,
    heading: "Your payment is confirmed",
    body: "Thank you. Zee has received your payment and is getting your order ready.",
  },
  shipped: {
    subject: ref => `Your order ${ref} is on its way`,
    heading: "Your order is on its way",
    body: "Your jewelry has been sent out for delivery. Zee will be in touch on WhatsApp if the rider needs anything.",
  },
  delivered: {
    subject: ref => `Your order ${ref} has been delivered`,
    heading: "Your order has been delivered",
    body: "We hope you love your pieces. If anything is not right, message Zee on WhatsApp.",
  },
};

/* Keys pasted into a dashboard often pick up spaces, line breaks or quote marks. */
const resendKey = () => (Netlify.env.get("RESEND_API_KEY") || "").trim().replace(/^["']+|["']+$/g, "").trim();

export function emailReady(settings: Settings) {
  const key = Boolean(resendKey()) || Netlify.env.get("EMAIL_OUTBOX") === "local";
  return { key, sender: Boolean(settings.email.fromAddress), on: key && Boolean(settings.email.fromAddress) };
}

function render(order: any, status: string, origin: string, settings: Settings) {
  const copy = COPY[status];
  const first = order.customer.name.split(/\s+/)[0];
  const link = trackUrl(origin, order);
  const wa = `https://wa.me/${settings.contact.whatsapp}`;
  const where = [order.delivery.address, order.delivery.city, order.delivery.lga && order.delivery.lga + " LGA", order.delivery.state].filter(Boolean).join(", ");
  const lines = [
    ...order.items.map((line: any) => [`${line.qty} × ${line.name}${line.size ? ` (${/^\d+(\.\d+)?$/.test(line.size) ? "size " : ""}${line.size})` : ""}`, money(line.price * line.qty)]),
    ...order.gifts.map((gift: any) => [`Gift: ${gift.pieces.map((piece: any) => piece.name + (piece.size ? ` (${/^\d+(\.\d+)?$/.test(piece.size) ? "size " : ""}${piece.size})` : "") + (piece.cash ? ` (${money(piece.cash)} cash)` : "")).join(", ")}`,
      money(gift.pieces.reduce((sum: number, piece: any) => sum + piece.price, 0))]),
  ];
  const row = (left: string, right: string, strong = false) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #ecd3ee;${strong ? "font-weight:600;" : ""}">${esc(left)}</td><td style="padding:8px 0;border-bottom:1px solid #ecd3ee;text-align:right;white-space:nowrap;${strong ? "font-weight:600;" : ""}">${esc(right)}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fdeeff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdeeff;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2a0f2e;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#2c0a31;padding:24px 28px;color:#f5cc7e;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:24px;">Glossy Gems <span style="font-style:normal;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:3px;color:#ffffff;">BY ZEE</span></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.15;color:#2a0f2e;">${esc(copy.heading)}</h1>
<p style="margin:0 0 6px;font-size:16px;line-height:1.5;">Hello ${esc(first)},</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${esc(copy.body)}</p>
<p style="margin:0 0 6px;font-size:14px;color:#6d4d72;">Order</p>
<p style="margin:0 0 18px;font-size:18px;font-weight:600;">${esc(order.ref)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
${lines.map(([left, right]) => row(left, right)).join("")}
${order.discount ? row(order.saleName || "Discount", "-" + money(order.discount)) : ""}
${row("Delivery", order.delivery.fee === null ? "Agreed with Zee" : order.delivery.fee === 0 ? "Free" : money(order.delivery.fee))}
${row(order.delivery.fee === null ? "Total before delivery" : "Total", money(order.total), true)}
</table>
<p style="margin:20px 0 4px;font-size:14px;color:#6d4d72;">Delivering to</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${esc(where)}</p>
${link ? `<p style="margin:0 0 24px;"><a href="${esc(link)}" style="display:inline-block;background:#690365;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:600;font-size:15px;">View your order</a></p>` : ""}
<p style="margin:0;font-size:14px;line-height:1.5;color:#6d4d72;">Questions? Message Zee on WhatsApp: <a href="${esc(wa)}" style="color:#690365;">${esc(settings.contact.whatsapp.replace(/^234(\d{3})(\d{3})(\d{4})$/, "0$1 $2 $3"))}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#2a3135;color:#c7d0d4;font-size:12px;line-height:1.6;">You're getting this email because you placed order ${esc(order.ref)}. We only email you about your orders and never send marketing, so there's nothing to unsubscribe from. <a href="${esc(origin)}/privacy.html" style="color:#f5cc7e;">Privacy policy</a><br>GLOSSYGEMZ BY ZEE ENTERPRISES · CAC registration no. 8636509 · Magboro, Ogun State, Nigeria</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: copy.subject(order.ref), html };
}

/* Returns { sent: true } or { sent: false, reason } in words the owner can act on. Never throws. */
export async function sendStatusEmail(order: any, status: string, origin: string, settings: Settings) {
  if (!EMAIL_STATUSES.includes(status)) return { sent: false, reason: "" };
  if (!order.customer.email) return { sent: false, reason: "This customer did not give an email address." };
  const ready = emailReady(settings);
  if (!ready.key) return { sent: false, reason: "Customer emails are not switched on yet (no Resend key on the site)." };
  if (!ready.sender) return { sent: false, reason: "Add the address emails come from in Settings." };
  const { subject, html } = render(order, status, origin, settings);
  const name = (settings.email.fromName || "Glossy Gems by Zee").replace(/[<>"]/g, "");
  const message: Record<string, unknown> = {
    from: `${name} <${settings.email.fromAddress}>`,
    to: [order.customer.email],
    subject,
    html,
    tags: [{ name: "status", value: status }],
  };
  if (settings.email.replyTo) message.reply_to = settings.email.replyTo;

  return deliver(message, `${order.ref}-${status}`, settings);
}

/* Sends one message through Resend (or the local outbox). Returns { sent, reason }; never throws. */
async function deliver(message: Record<string, unknown>, outboxKey: string, settings: Settings) {
  if (Netlify.env.get("EMAIL_OUTBOX") === "local") {
    await getStore({ name: "outbox", consistency: "strong" }).setJSON(outboxKey, message);
    return { sent: true, reason: "" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return { sent: true, reason: "" };
    const detail = await response.json().catch(() => ({})) as { name?: string; message?: string };
    console.error("resend", response.status, detail.name, detail.message);
    const text = detail.message || "";
    if (detail.name === "daily_quota_exceeded") return { sent: false, reason: "Today's free email limit is used up. Send it again tomorrow (the limit resets at 1am Lagos time)." };
    if (detail.name === "monthly_quota_exceeded") return { sent: false, reason: "This month's email limit is used up. Upgrade the Resend plan or send it again next month." };
    if (detail.name === "rate_limit_exceeded") return { sent: false, reason: "Resend is busy. Send it again in a moment." };
    if (/not authorized to send emails from/i.test(text)) return { sent: false, reason: `"Send emails from" in Settings is ${settings.email.fromAddress}. It must be an address on your verified domain, like orders@glossygemzbyzee.com.` };
    if (/not verified|own email address/i.test(text)) return { sent: false, reason: "The sending domain isn't verified in Resend yet, or the address in Settings isn't on it." };
    if (response.status === 401 || /api key/i.test(text)) return { sent: false, reason: `Resend refused the key: "${text || detail.name || response.status}". Create a new key in Resend and paste it into RESEND_API_KEY on Netlify.` };
    return { sent: false, reason: `Resend did not send it (${text || "error " + response.status}).` };
  } catch {
    return { sent: false, reason: "Could not reach Resend. Try sending again in a moment." };
  }
}

/* New-order alert for the owner: everything needed to act on the order without opening the dashboard first. */
export async function sendOrderAlert(order: any, key: string, origin: string, settings: Settings) {
  const to = settings.email.alertTo;
  if (!to) return { sent: false, reason: "New order alerts are off." };
  const ready = emailReady(settings);
  if (!ready.on) return { sent: false, reason: "Emails are not switched on." };

  const option = (size: string) => size ? ` (${/^\d+(\.\d+)?$/.test(size) ? "size " : ""}${size})` : "";
  const lines = [
    ...order.items.map((line: any) => [`${line.qty} × ${line.name}${option(line.size)}`, money(line.price * line.qty), ""]),
    ...order.gifts.map((gift: any) => [
      `Gift: ${gift.pieces.map((piece: any) => piece.name + option(piece.size) + (piece.cash ? ` (${money(piece.cash)} cash + ${money(piece.fee)} fee)` : "")).join(", ")}`,
      money(gift.pieces.reduce((sum: number, piece: any) => sum + piece.price, 0)),
      gift.note ? `Note: “${gift.note}”` : "",
    ]),
  ];
  const fee = order.delivery.fee;
  const phone = order.customer.phone.replace(/^\+/, "").replace(/^0/, "234");
  const where = [order.delivery.address, order.delivery.city, order.delivery.lga && order.delivery.lga + " LGA", order.delivery.state].filter(Boolean).join(", ");
  const dashboard = `${origin}/admin/#/orders/${encodeURIComponent(key)}`;
  const cell = "padding:8px 0;border-bottom:1px solid #ecd3ee;vertical-align:top;";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fdeeff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdeeff;padding:20px 12px;font-family:Arial,Helvetica,sans-serif;color:#2a0f2e;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#2c0a31;padding:18px 24px;color:#f5cc7e;font-size:14px;letter-spacing:2px;">NEW ORDER</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;">${esc(order.ref)} · ${esc(money(order.total))}</h1>
<p style="margin:0 0 18px;color:#6d4d72;font-size:14px;">${fee === null ? "Before delivery: agree the delivery fee with the customer." : "Includes delivery."}${order.freeGift ? " Earned a free gift: pack one." : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
${lines.map(([left, right, note]) => `<tr><td style="${cell}">${esc(left)}${note ? `<br><span style="color:#690365;font-style:italic;">${esc(note)}</span>` : ""}</td><td style="${cell}text-align:right;white-space:nowrap;">${esc(right)}</td></tr>`).join("")}
${order.discount ? `<tr><td style="${cell}">${esc(order.saleName)}</td><td style="${cell}text-align:right;">-${esc(money(order.discount))}</td></tr>` : ""}
<tr><td style="${cell}">Delivery</td><td style="${cell}text-align:right;">${fee === null ? "Not set" : fee === 0 ? "Free" : esc(money(fee))}</td></tr>
</table>
<p style="margin:20px 0 4px;font-size:14px;color:#6d4d72;">Customer</p>
<p style="margin:0;font-size:15px;line-height:1.6;">${esc(order.customer.name)}<br>${esc(order.customer.phone)}<br>${esc(order.customer.email)}</p>
<p style="margin:16px 0 4px;font-size:14px;color:#6d4d72;">Deliver to</p>
<p style="margin:0;font-size:15px;line-height:1.6;">${esc(where)}${order.delivery.note ? `<br><span style="color:#6d4d72;">Note: ${esc(order.delivery.note)}</span>` : ""}</p>
<p style="margin:24px 0 0;">
<a href="${esc(dashboard)}" style="display:inline-block;background:#690365;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px;margin:0 8px 8px 0;">Open in dashboard</a>
<a href="https://wa.me/${esc(phone)}" style="display:inline-block;border:1.5px solid #690365;color:#690365;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600;font-size:15px;">WhatsApp the customer</a>
</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#2a3135;color:#c7d0d4;font-size:12px;">Sent to you because new order alerts are on in Settings. Turn them off there by clearing the address.</td></tr>
</table></td></tr></table></body></html>`;
  const name = (settings.email.fromName || "Glossy Gems by Zee").replace(/[<>"]/g, "");
  const message: Record<string, unknown> = {
    from: `${name} <${settings.email.fromAddress}>`,
    to: [to],
    subject: `New order ${order.ref} · ${money(order.total)} · ${order.customer.name}`,
    html,
    tags: [{ name: "status", value: "new-order-alert" }],
  };
  if (order.customer.email) message.reply_to = order.customer.email;
  return deliver(message, `${order.ref}-alert`, settings);
}

/* Stock alert for the owner: pieces that just ran low or sold out because of an order. */
export async function sendStockAlert(items: { id: string; name: string; left: number }[], ref: string, origin: string, settings: Settings) {
  const to = settings.email.alertTo;
  if (!to) return { sent: false, reason: "Alerts are off." };
  if (!emailReady(settings).on) return { sent: false, reason: "Emails are not switched on." };
  const out = items.filter(item => item.left <= 0);
  const subject = items.length === 1
    ? (out.length ? `Sold out: ${items[0].name}` : `Running low: ${items[0].name} (${items[0].left} left)`)
    : `Stock alert: ${items.length} pieces ${out.length === items.length ? "sold out" : "running low"}`;
  const rows = items.map(item => `<tr><td style="padding:10px 0;border-bottom:1px solid #ecd3ee;">${esc(item.name)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #ecd3ee;text-align:right;font-weight:600;color:${item.left <= 0 ? "#a3123f" : "#2a0f2e"};">${item.left <= 0 ? "Sold out" : `${item.left} left`}</td>
    <td style="padding:10px 0 10px 16px;border-bottom:1px solid #ecd3ee;text-align:right;"><a href="${esc(`${origin}/admin/#/products/${encodeURIComponent(item.id)}`)}" style="color:#690365;">Restock</a></td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fdeeff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdeeff;padding:20px 12px;font-family:Arial,Helvetica,sans-serif;color:#2a0f2e;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#2c0a31;padding:18px 24px;color:#f5cc7e;font-size:14px;letter-spacing:2px;">STOCK ALERT</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">Order ${esc(ref)} just took ${items.length === 1 ? "this piece" : "these pieces"} ${out.length === items.length ? "out of stock" : "to a low level"}. ${out.length ? "Sold-out pieces show as Sold out in the store until you add stock, and any combo that uses them does too." : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">${rows}</table>
</td></tr>
<tr><td style="padding:14px 24px;background:#2a3135;color:#c7d0d4;font-size:12px;">Sent because stock alerts are on in Settings → Customer emails.</td></tr>
</table></td></tr></table></body></html>`;
  const name = (settings.email.fromName || "Glossy Gems by Zee").replace(/[<>"]/g, "");
  return deliver({ from: `${name} <${settings.email.fromAddress}>`, to: [to], subject, html, tags: [{ name: "status", value: "stock-alert" }] }, `${ref}-stock`, settings);
}
