import {
  assertSameOrigin,
  errorResponse,
  json,
  normalizePost,
  postForClient,
  readJson,
  readyDb,
  requireAuth,
  uniqueSlug
} from "../../_lib/writing.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = await readyDb(env);
    const requestUrl = new URL(request.url);
    const wantsAll = requestUrl.searchParams.get("scope") === "all";
    if (wantsAll) await requireAuth(db, request);
    const query = wantsAll
      ? "SELECT * FROM writing_posts ORDER BY updated_at DESC"
      : "SELECT * FROM writing_posts WHERE status = 'published' ORDER BY published_at DESC, id DESC";
    const result = await db.prepare(query).all();
    return json({ posts: result.results.map(postForClient) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    await requireAuth(db, request);
    const post = normalizePost(await readJson(request));
    const slug = await uniqueSlug(db, post.title);
    const now = new Date().toISOString();
    const publishedAt = post.status === "published" ? now : null;
    const result = await db.prepare(`
      INSERT INTO writing_posts
        (title, slug, summary, body, status, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      post.title,
      slug,
      post.summary,
      post.body,
      post.status,
      now,
      now,
      publishedAt
    ).run();
    const row = await db.prepare("SELECT * FROM writing_posts WHERE id = ?")
      .bind(result.meta.last_row_id).first();
    return json({ post: postForClient(row) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}
