import {
  assertSameOrigin,
  createCredentials,
  createSession,
  errorResponse,
  HttpError,
  json,
  readJson,
  readyDb
} from "../../_lib/writing.js";

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    const payload = await readJson(request);
    const created = await createCredentials(db, payload.password);
    if (!created) throw new HttpError("A password has already been set.", 409);
    const cookie = await createSession(db, request);
    return json({ ok: true }, 201, { "Set-Cookie": cookie });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
