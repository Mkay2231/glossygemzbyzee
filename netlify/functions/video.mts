import type { Config, Context } from "@netlify/functions";
import { readRange } from "../lib/videos.mts";

/* GET /media/video/:id: product video playback in byte ranges, the way video players ask for it.
   Each answer is at most one 3 MB piece; the player simply asks for the next range. */
export default async (req: Request, context: Context) => {
  const result = await readRange(context.params.id, req.headers.get("range"));
  if (!result) return new Response("Not found", { status: 404 });
  const common = {
    "Accept-Ranges": "bytes",
    "Content-Type": result.meta.type,
    "X-Content-Type-Options": "nosniff",
    /* Browsers may keep pieces (a video never changes once uploaded); the CDN must not, because it
       would hand one range to someone who asked for another. */
    "Cache-Control": "public, max-age=31536000, immutable",
    "Netlify-CDN-Cache-Control": "no-store",
  };
  if ("unsatisfiable" in result) {
    return new Response(null, { status: 416, headers: { ...common, "Content-Range": `bytes */${result.meta.size}` } });
  }
  return new Response(result.body, {
    status: result.partial ? 206 : 200,
    headers: {
      ...common,
      "Content-Length": String(result.end - result.start + 1),
      ...(result.partial ? { "Content-Range": `bytes ${result.start}-${result.end}/${result.meta.size}` } : {}),
    },
  });
};

export const config: Config = { path: "/media/video/:id", method: "GET" };
