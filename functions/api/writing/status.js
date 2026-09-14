import {
  errorResponse,
  getCredentials,
  isAuthenticated,
  json,
  readyDb
} from "../../_lib/writing.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = await readyDb(env);
    const credentials = await getCredentials(db);
    return json({
      needsSetup: credentials === null,
      authenticated: credentials !== null && await isAuthenticated(db, request)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}
