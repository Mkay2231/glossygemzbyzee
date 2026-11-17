/* Link previews and search details for product and blog pages.

   product.html and post.html are one file each; the page fills itself in with JavaScript.
   WhatsApp, Instagram, Facebook and X don't run JavaScript when they build a link preview,
   so without this every shared link would show the same generic card. This edge function
   takes the static page on its way out and writes the piece's own name, price, description
   and photo into the <head>, plus structured product details that Google reads.

   It only uses what the public store already shows (/api/store and /api/blog), so drafts
   and hidden products never leak. If anything goes wrong, the plain page is sent unchanged. */

declare const Netlify: { env: { get(name: string): string | undefined } };

const STORE = "Glossy Gems by Zee";
const FALLBACK_IMAGE = "/assets/img/model.jpg";

type Meta = {
  title: string; ogTitle: string; description: string; image: string; url: string; type: string;
  extra: string[]; data: Record<string, unknown>;
};

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = (value: string, max: number) => {
  const text = String(value || "").replace(/^#+\s*|^-\s+/gm, "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : text;
};
const naira = (amount: number) => "₦" + Math.round(amount).toLocaleString("en-NG");
const photoPath = (photo: string) => /^[a-f0-9-]{36}$/.test(photo) ? "/media/" + photo : "/" + photo.replace(/^\/+/, "");

async function productMeta(url: URL, site: string): Promise<Meta | null> {
  const id = url.searchParams.get("id");
  if (!id) return null;
  const response = await fetch(new URL("/api/store", url.origin));
  if (!response.ok) return null;
  const { products } = await response.json();
  const product = (products || []).find((item: any) => item.id === id);
  if (!product || product.type === "Gift items") return null;

  const members = (product.members || []).map((memberId: string) => products.find((item: any) => item.id === memberId)).filter(Boolean);
  const photos: string[] = (product.photos?.length ? product.photos : members.flatMap((member: any) => member.photos || []).slice(0, 3));
  const images = (photos.length ? photos : [FALLBACK_IMAGE.slice(1)]).map(photo => site + photoPath(photo));
  const inStock = product.stock > 0;
  const page = `${site}/product.html?id=${encodeURIComponent(product.id)}`;
  const about = plain(product.description, 200)
    || (members.length ? `A set of ${members.map((member: any) => member.name).join(", ")}.` : `${product.type} from ${STORE}.`);
  const description = `${inStock ? "" : "Sold out for now. "}${about} Delivered across Nigeria.`;

  return {
    title: `${product.name} | ${STORE}`,
    ogTitle: `${product.name} · ${naira(product.price)}`,
    description, image: images[0], url: page, type: "product",
    extra: [
      `<meta property="product:price:amount" content="${product.price}">`,
      `<meta property="product:price:currency" content="NGN">`,
      `<meta property="product:availability" content="${inStock ? "in stock" : "out of stock"}">`,
    ],
    data: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: about,
      image: images,
      sku: product.id,
      category: product.type,
      brand: { "@type": "Brand", name: STORE },
      offers: {
        "@type": "Offer",
        url: page,
        price: product.price,
        priceCurrency: "NGN",
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: STORE },
      },
    },
  };
}

async function postMeta(url: URL, site: string): Promise<Meta | null> {
  const slug = url.searchParams.get("slug");
  if (!slug) return null;
  const response = await fetch(new URL("/api/blog?slug=" + encodeURIComponent(slug), url.origin));
  if (!response.ok) return null;
  const { post } = await response.json();
  if (!post) return null;
  const image = site + photoPath(post.cover || FALLBACK_IMAGE.slice(1));
  const page = `${site}/post.html?slug=${encodeURIComponent(post.id)}`;
  const description = plain(post.excerpt || post.body, 200);
  return {
    title: `${post.title} | ${STORE}`, ogTitle: post.title, description, image, url: page, type: "article",
    extra: [`<meta property="article:published_time" content="${attr(post.publishedAt || "")}">`],
    data: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      image: [image],
      datePublished: post.publishedAt,
      mainEntityOfPage: page,
      author: { "@type": "Organization", name: STORE },
      publisher: { "@type": "Organization", name: STORE, logo: { "@type": "ImageObject", url: site + "/assets/img/logo-badge.jpg" } },
    },
  };
}

function rewrite(html: string, meta: Meta) {
  const set = (pattern: RegExp, tag: string) => (html = pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", tag + "\n</head>"));
  set(/<title>[^<]*<\/title>/, `<title>${attr(meta.title)}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${attr(meta.description)}">`);
  set(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${meta.type}">`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${attr(meta.ogTitle)}">`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${attr(meta.description)}">`);
  set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${attr(meta.image)}">`);
  /* JSON-LD is data, not script: the page's security policy doesn't run it, Google reads it.
     "<" is escaped so nothing inside can close the tag. */
  const json = JSON.stringify(meta.data).replace(/</g, "\\u003c");
  const added = [
    `<meta property="og:url" content="${attr(meta.url)}">`,
    `<meta property="og:image:alt" content="${attr(meta.ogTitle)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="canonical" href="${attr(meta.url)}">`,
    ...meta.extra,
    `<script type="application/ld+json">${json}</script>`,
  ];
  return html.replace("</head>", added.join("\n") + "\n</head>");
}

export default async (req: Request, context: { next: () => Promise<Response> }) => {
  const page = await context.next();
  if (page.status !== 200 || !(page.headers.get("content-type") || "").includes("text/html")) return page;
  const html = await page.text();
  const headers = new Headers(page.headers);
  headers.delete("content-length");
  headers.delete("etag");
  try {
    const url = new URL(req.url);
    const site = (Netlify.env.get("URL") || url.origin).replace(/\/$/, "");
    const meta = url.pathname.startsWith("/post") ? await postMeta(url, site) : await productMeta(url, site);
    if (!meta) return new Response(html, { status: 200, headers });
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(rewrite(html, meta), { status: 200, headers });
  } catch (error) {
    console.error("preview not added", error);
    return new Response(html, { status: 200, headers });
  }
};

export const config = { path: ["/product.html", "/product", "/post.html", "/post"] };
