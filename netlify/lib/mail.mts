import { getStore } from "@netlify/blobs";
import { trackUrl, type Settings } from "./store.mts";

/* Customer status emails, sent through Brevo's transactional API.
   Switched on when BREVO_API_KEY is set on the site and a sender address is saved in Settings.
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

export function emailReady(settings: Settings) {
  const key = Boolean(Netlify.env.get("BREVO_API_KEY")) || Netlify.env.get("EMAIL_OUTBOX") === "local";
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
  if (!ready.key) return { sent: false, reason: "Customer emails are not switched on yet (no Brevo key on the site)." };
  if (!ready.sender) return { sent: false, reason: "Add the address emails come from in Settings." };
  const { subject, html } = render(order, status, origin, settings);
  const sender = { name: settings.email.fromName || "Glossy Gems by Zee", email: settings.email.fromAddress };
  const message = { sender, replyTo: sender, to: [{ email: order.customer.email, name: order.customer.name }], subject, htmlContent: html };

  if (Netlify.env.get("EMAIL_OUTBOX") === "local") {
    await getStore({ name: "outbox", consistency: "strong" }).setJSON(`${order.ref}-${status}`, message);
    return { sent: true, reason: "" };
  }
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": Netlify.env.get("BREVO_API_KEY")!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return { sent: true, reason: "" };
    const detail = await response.json().catch(() => ({})) as { message?: string };
    console.error("brevo", response.status, detail.message);
    if (response.status === 401) return { sent: false, reason: "Brevo refused the key. Check BREVO_API_KEY on the site." };
    if (/sender/i.test(detail.message || "")) return { sent: false, reason: "Brevo has not verified the sender address yet. Verify it in Brevo, then send again." };
    return { sent: false, reason: `Brevo did not send it (${detail.message || "error " + response.status}).` };
  } catch {
    return { sent: false, reason: "Could not reach Brevo. Try sending again in a moment." };
  }
}
