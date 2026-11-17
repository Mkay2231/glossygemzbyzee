import type { Config } from "@netlify/functions";
import { readCatalog, readSettings, json } from "../lib/store.mts";

/* Everything the storefront needs in one request: published products and public settings.
   Bank details are deliberately left out; they are only sent with a placed order. */
export default async () => {
  const [{ products }, settings] = await Promise.all([readCatalog(), readSettings()]);
  return json({
    products: products.filter(product => product.published).map(({ published, updatedAt, sample, ...product }) => product),
    sample: products.some(product => product.sample && product.published),
    sale: settings.sale,
    delivery: settings.delivery,
    contact: settings.contact,
    policies: settings.policies,
  }, 200, { "Cache-Control": "public, max-age=0, must-revalidate" });
};

export const config: Config = { path: "/api/store", method: "GET" };
