import {
  assertSameOrigin,
  errorResponse,
  HttpError,
  json,
  normalizePost,
  postForClient,
  readJson,
  readyDb,
  requireAuth,
  uniqueSlug
} from "../../../_lib/writing.js";

function postId(params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError("Invalid post.");
  return id;
}

export async function onRequestPut({ request, env, params }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    await requireAuth(db, request);
    const id = postId(params);
    const existing = await db.prepare("SELECT * FROM writing_posts WHERE id = ?").bind(id).first();
    if (!existing) throw new HttpError("Post not found.", 404);

    const post = normalizePost(await readJson(request));
    const slug = post.title === existing.title
      ? existing.slug
      : await uniqueSlug(db, post.title, id);
    const now = new Date().toISOString();
    const publishedAt = post.status === "published"
      ? (existing.published_at || now)
      : null;
    await db.prepare(`
      UPDATE writing_posts
      SET title = ?, slug = ?, summary = ?, body = ?, status = ?, updated_at = ?, published_at = ?
      WHERE id = ?
    `).bind(
      post.title,
      slug,
      post.summary,
      post.body,
      post.status,
      now,
      publishedAt,
      id
    ).run();
    const row = await db.prepare("SELECT * FROM writing_posts WHERE id = ?").bind(id).first();
    return json({ post: postForClient(row) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    await requireAuth(db, request);
    const result = await db.prepare("DELETE FROM writing_posts WHERE id = ?")
      .bind(postId(params)).run();
    if (result.meta.changes === 0) throw new HttpError("Post not found.", 404);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context) {
  if (context.request.method === "PUT") return onRequestPut(context);
  if (context.request.method === "DELETE") return onRequestDelete(context);
  return new Response(null, { status: 405, headers: { Allow: "PUT, DELETE" } });
}
