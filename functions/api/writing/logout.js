import {
  assertSameOrigin,
  destroySession,
  errorResponse,
  json,
  readyDb
} from "../../_lib/writing.js";

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    const cookie = await destroySession(db, request);
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
