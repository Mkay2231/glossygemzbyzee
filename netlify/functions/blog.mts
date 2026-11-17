import type { Config } from "@netlify/functions";
import { readBlog, excerptOf, json, fail, text } from "../lib/store.mts";

/* Published blog posts.
   GET /api/blog            newest first, without the body
   GET /api/blog?slug=...   one post with its body */
export default async (req: Request) => {
  const slug = text(new URL(req.url).searchParams.get("slug"), 80);
  const posts = (await readBlog()).posts.filter(post => post.published)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const cache = { "Cache-Control": "public, max-age=0, must-revalidate" };
  if (slug) {
    const post = posts.find(item => item.id === slug);
    if (!post) return fail("That post isn't available.", 404);
    const index = posts.indexOf(post);
    const near = (item?: typeof post) => item ? { id: item.id, title: item.title } : null;
    return json({ post: { id: post.id, title: post.title, body: post.body, cover: post.cover, publishedAt: post.publishedAt, excerpt: excerptOf(post) },
      newer: near(posts[index - 1]), older: near(posts[index + 1]) }, 200, cache);
  }
  return json({ posts: posts.map(post => ({ id: post.id, title: post.title, cover: post.cover, publishedAt: post.publishedAt, excerpt: excerptOf(post) })) }, 200, cache);
};

export const config: Config = { path: "/api/blog", method: "GET" };
