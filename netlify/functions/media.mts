import type { Config, Context } from "@netlify/functions";
import { photos } from "../lib/store.mts";

/* Product photos. Ids are random and a photo never changes once uploaded, so browsers may keep it. */
export default async (req: Request, context: Context) => {
  const { id } = context.params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const entry = await photos().getWithMetadata(id, { type: "arrayBuffer" });
  if (entry === null) return new Response("Not found", { status: 404 });
  return new Response(entry.data, {
    headers: {
      "Content-Type": String(entry.metadata.type || "image/jpeg"),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const config: Config = { path: "/media/:id", method: "GET" };
