import type { Config } from "@netlify/functions";
import { readCatalog, readBlog, GIFT_TYPE } from "../lib/store.mts";

/* GET /sitemap.xml: every public page, product and blog post, so Google finds new pieces
   as soon as they're published. Built fresh from the catalogue on each request. */

const PAGES = ["/", "/shop.html", "/gift.html", "/help.html", "/privacy.html", "/terms.html", "/refunds.html", "/cookies.html"];
const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async (req: Request) => {
  const site = (Netlify.env.get("URL") || new URL(req.url).origin).replace(/\/$/, "");
  const [{ products }, { posts }] = await Promise.all([readCatalog(), readBlog()]);
  const live = posts.filter(post => post.published);
  const urls: { loc: string; lastmod?: string }[] = [
    ...PAGES.map(path => ({ loc: site + path })),
    ...(live.length ? [{ loc: site + "/blog.html" }] : []),
    ...products.filter(product => product.published && product.type !== GIFT_TYPE)
      .map(product => ({ loc: `${site}/product.html?id=${encodeURIComponent(product.id)}`, lastmod: product.updatedAt })),
    ...live.map(post => ({ loc: `${site}/post.html?slug=${encodeURIComponent(post.id)}`, lastmod: (post as any).updatedAt || post.publishedAt })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${xml(url.loc)}</loc>${url.lastmod ? `<lastmod>${xml(url.lastmod.slice(0, 10))}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" } });
};

export const config: Config = { path: "/sitemap.xml", method: "GET" };
