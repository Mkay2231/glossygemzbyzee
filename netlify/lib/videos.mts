import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

/* Product videos. A request to the site can carry only a few megabytes, so a video is uploaded
   and stored in 3 MB pieces: "meta/<id>" describes it and "part/<id>/<n>" holds each piece.
   Playback asks for one byte range at a time (as phones do anyway), so each answer is one piece. */

export const CHUNK = 3 * 1024 * 1024;
export const MAX_VIDEO = 60 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const STALE = 24 * 60 * 60 * 1000;

export type VideoMeta = { type: string; size: number; parts: number; done: boolean; at: string };
export type Video = { id: string; type: string; size: number };

export const videos = () => getStore({ name: "videos", consistency: "strong" });
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const isVideoId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);

export const readMeta = (id: string) => videos().get(`meta/${id}`, { type: "json" }) as Promise<VideoMeta | null>;
const partKey = (id: string, n: number) => `part/${id}/${String(n).padStart(3, "0")}`;
export const partSize = (meta: VideoMeta, n: number) => n < meta.parts - 1 ? CHUNK : meta.size - CHUNK * (meta.parts - 1);

export class VideoProblem extends Error { constructor(message: string, public status = 400) { super(message); } }

/* Begin an upload. Also clears out uploads that were never finished or never saved to a product. */
export async function startUpload(type: string, size: number, inUse: Set<string>) {
  if (!VIDEO_TYPES.includes(type)) throw new VideoProblem("Choose an MP4 or iPhone (MOV) video.");
  if (!Number.isSafeInteger(size) || size < 1) throw new VideoProblem("That video could not be read.");
  if (size > MAX_VIDEO) throw new VideoProblem("That video is too large. Videos can be up to 60 MB.");
  await sweep(inUse);
  const id = randomUUID();
  const meta: VideoMeta = { type, size, parts: Math.ceil(size / CHUNK), done: false, at: new Date().toISOString() };
  await videos().setJSON(`meta/${id}`, meta);
  return { id, chunk: CHUNK, parts: meta.parts };
}

export async function putPart(id: string, n: number, bytes: Uint8Array) {
  const meta = isVideoId(id) ? await readMeta(id) : null;
  if (!meta || meta.done) throw new VideoProblem("This upload has expired. Choose the video again.", 404);
  if (!Number.isInteger(n) || n < 0 || n >= meta.parts) throw new VideoProblem("That part of the video is not expected.");
  if (bytes.length !== partSize(meta, n)) throw new VideoProblem("Part of the video went missing on the way. Try again.");
  /* The first piece must look like an MP4/MOV file: its first box is "ftyp". */
  if (n === 0 && String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") throw new VideoProblem("That file is not a video this store can use.");
  await videos().set(partKey(id, n), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer);
}

export async function finishUpload(id: string): Promise<Video> {
  const meta = isVideoId(id) ? await readMeta(id) : null;
  if (!meta) throw new VideoProblem("This upload has expired. Choose the video again.", 404);
  const { blobs } = await videos().list({ prefix: `part/${id}/` });
  if (blobs.length !== meta.parts) throw new VideoProblem("Some of the video didn't arrive. Try again.");
  await videos().setJSON(`meta/${id}`, { ...meta, done: true });
  return { id, type: meta.type, size: meta.size };
}

/* A finished video, ready to attach to a product. */
export async function videoFor(input: unknown): Promise<Video | null> {
  if (input === null || input === undefined || input === "") return null;
  const id = (input as any)?.id;
  const meta = isVideoId(id) ? await readMeta(id) : null;
  if (!meta?.done) throw new VideoProblem("The video is missing. Upload it again.");
  return { id, type: meta.type, size: meta.size };
}

export async function dropVideo(id: string | undefined | null) {
  if (!isVideoId(id)) return;
  const { blobs } = await videos().list({ prefix: `part/${id}/` });
  await Promise.all(blobs.map(blob => videos().delete(blob.key)));
  await videos().delete(`meta/${id}`);
}

/* Remove uploads older than a day that no product uses (abandoned or replaced before saving). */
async function sweep(inUse: Set<string>) {
  const { blobs } = await videos().list({ prefix: "meta/" });
  for (const blob of blobs) {
    const id = blob.key.slice(5);
    if (inUse.has(id)) continue;
    const meta = await readMeta(id);
    if (!meta || Date.now() - Date.parse(meta.at) > STALE) await dropVideo(id);
  }
}

/* One piece of a video for playback: the requested range, trimmed to end inside a single stored piece. */
export async function readRange(id: string, range: string | null) {
  const meta = isVideoId(id) ? await readMeta(id) : null;
  if (!meta?.done) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec((range || "").trim());
  let start = 0;
  let end = meta.size - 1;
  if (match && (match[1] || match[2])) {
    if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), meta.size - 1); }
    else { start = Math.max(0, meta.size - Number(match[2])); }
    if (start >= meta.size || start > end) return { meta, unsatisfiable: true as const };
  }
  const n = Math.floor(start / CHUNK);
  end = Math.min(end, (n + 1) * CHUNK - 1);
  const piece = await videos().get(partKey(id, n), { type: "arrayBuffer" });
  if (!piece) return null;
  const body = piece.slice(start - n * CHUNK, end - n * CHUNK + 1);
  return { meta, start, end, body, partial: Boolean(match) || end < meta.size - 1 };
}
