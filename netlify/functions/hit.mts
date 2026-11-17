import type { Config, Context } from "@netlify/functions";
import { sameOrigin, text } from "../lib/store.mts";
import { signedIn } from "../lib/auth.mts";
import { record } from "../lib/stats.mts";

/* POST /api/hit { page, product, source }: count one page view. Answers 204 whatever happens,
   so a counting problem can never get in a shopper's way. */

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch|axios|monitor|uptime/i;
const PAGES = new Set(["/", "/shop.html", "/product.html", "/gift.html", "/checkout.html", "/help.html", "/order.html",
  "/blog.html", "/post.html", "/privacy.html", "/terms.html", "/refunds.html", "/cookies.html", "/404.html"]);

const deviceOf = (agent: string) =>
  /iPad|Tablet|Android(?!.*Mobile)/i.test(agent) ? "Tablet" : /Mobi|iPhone|Android/i.test(agent) ? "Phone" : "Computer";

/* Where the visit came from, in plain words: "instagram", "google", or "Direct". */
function sourceOf(value: string) {
  const host = value.toLowerCase().replace(/^(www|m|l|lm|mobile)\./, "");
  if (!host) return "Direct";
  if (!/^[a-z0-9][a-z0-9.-]{0,79}$/.test(host)) return "";
  /* Matches a referring site (l.instagram.com) or a ?src= tag on a shared link (instagram, ig). */
  const known: [RegExp, string][] = [[/(^|\.)instagram(\.com)?$|^ig$/, "Instagram"], [/(^|\.)facebook(\.com)?$|^fb$/, "Facebook"],
    [/(^|\.)tiktok(\.com)?$/, "TikTok"], [/(^|\.)whatsapp(\.(com|net))?$|^wa(\.me)?$/, "WhatsApp"], [/(^|\.)google(\.|$)/, "Google"],
    [/(^|\.)bing(\.com)?$/, "Bing"], [/^(t\.co|x\.com|x|twitter(\.com)?)$/, "X (Twitter)"], [/(^|\.)snapchat(\.com)?$/, "Snapchat"]];
  return known.find(([pattern]) => pattern.test(host))?.[1] || host;
}

export default async (req: Request, context: Context) => {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    const agent = req.headers.get("user-agent") || "";
    if (!sameOrigin(req) || !agent || BOTS.test(agent)) return done;
    if (await signedIn(req)) return done; // Zee's own browsing doesn't count
    const body = await req.json().catch(() => ({}));
    const page = text(body?.page, 40);
    if (!PAGES.has(page)) return done;
    const product = page === "/product.html" ? text(body?.product, 80).replace(/[^a-z0-9-]/gi, "") : "";
    const source = sourceOf(text(body?.source, 80));
    await record({ ip: context.ip || "", agent, page, product, source, device: deviceOf(agent) });
  } catch (error) {
    console.error("hit not counted", error);
  }
  return done;
};

export const config: Config = {
  path: "/api/hit",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
