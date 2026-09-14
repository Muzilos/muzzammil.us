import {
  assertSameOrigin,
  createSession,
  errorResponse,
  getCredentials,
  HttpError,
  json,
  readJson,
  readyDb,
  verifyPassword
} from "../../_lib/writing.js";

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const db = await readyDb(env);
    const payload = await readJson(request);
    const credentials = await getCredentials(db);
    if (!credentials) throw new HttpError("Set the editor password first.", 409);
    if (!(await verifyPassword(payload.password, credentials))) {
      throw new HttpError("That password is not correct.", 401);
    }
    const cookie = await createSession(db, request);
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
