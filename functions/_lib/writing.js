const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const SESSION_COOKIE = "writing_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210000;

let schemaReady;

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...headers }
  });
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error("Writing API error", error);
  return json({ error: "The writing service is temporarily unavailable." }, 500);
}

export async function readyDb(env) {
  if (!env.WRITING_DB) {
    throw new HttpError("Writing is not configured yet.", 503);
  }

  if (!schemaReady) {
    schemaReady = env.WRITING_DB.batch([
      env.WRITING_DB.prepare(`CREATE TABLE IF NOT EXISTS writing_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.WRITING_DB.prepare(`CREATE TABLE IF NOT EXISTS writing_sessions (
        token_hash TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`),
      env.WRITING_DB.prepare(`CREATE TABLE IF NOT EXISTS writing_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      )`),
      env.WRITING_DB.prepare(`CREATE INDEX IF NOT EXISTS writing_posts_public
        ON writing_posts(status, published_at DESC)`)
    ]).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }

  await schemaReady;
  return env.WRITING_DB;
}

export function assertSameOrigin(request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if ((origin && origin !== requestUrl.origin) || fetchSite === "cross-site") {
    throw new HttpError("Cross-site requests are not allowed.", 403);
  }
}

export async function getCredentials(db) {
  const row = await db.prepare(
    "SELECT value FROM writing_settings WHERE key = 'admin_credentials'"
  ).first();
  if (!row) return null;

  try {
    const credentials = JSON.parse(row.value);
    if (!credentials.salt || !credentials.hash) throw new Error("Incomplete credentials");
    return credentials;
  } catch {
    throw new HttpError("The editor credentials are invalid.", 500);
  }
}

export async function createCredentials(db, password) {
  validatePassword(password);
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  const credentials = JSON.stringify({
    version: 1,
    iterations: PASSWORD_ITERATIONS,
    salt: bytesToBase64Url(salt),
    hash: bytesToBase64Url(hash)
  });
  const now = new Date().toISOString();
  const result = await db.prepare(
    "INSERT OR IGNORE INTO writing_settings (key, value, updated_at) VALUES ('admin_credentials', ?, ?)"
  ).bind(credentials, now).run();
  return result.meta.changes === 1;
}

export async function verifyPassword(password, credentials) {
  if (typeof password !== "string") return false;
  const salt = base64UrlToBytes(credentials.salt);
  const expected = base64UrlToBytes(credentials.hash);
  const actual = await derivePassword(
    password,
    salt,
    Number(credentials.iterations) || PASSWORD_ITERATIONS
  );
  return constantTimeEqual(actual, expected);
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new HttpError("Use a password with at least 12 characters.");
  }
  if (password.length > 256) throw new HttpError("The password is too long.");
}

export async function createSession(db, request) {
  const token = bytesToBase64Url(randomBytes(32));
  const tokenHash = await sha256(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  await db.prepare("DELETE FROM writing_sessions WHERE expires_at <= ?")
    .bind(createdAt.toISOString()).run();
  await db.prepare(
    "INSERT INTO writing_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)"
  ).bind(tokenHash, createdAt.toISOString(), expiresAt.toISOString()).run();

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

export async function isAuthenticated(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await db.prepare(
    "SELECT expires_at FROM writing_sessions WHERE token_hash = ?"
  ).bind(tokenHash).first();
  if (!session) return false;
  if (session.expires_at <= now) {
    await db.prepare("DELETE FROM writing_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return false;
  }
  return true;
}

export async function requireAuth(db, request) {
  if (!(await isAuthenticated(db, request))) {
    throw new HttpError("Sign in to use the editor.", 401);
  }
}

export async function destroySession(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await db.prepare("DELETE FROM writing_sessions WHERE token_hash = ?")
      .bind(await sha256(token)).run();
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 150000) throw new HttpError("The request is too large.", 413);
  try {
    return await request.json();
  } catch {
    throw new HttpError("Invalid request body.");
  }
}

export function normalizePost(payload) {
  const title = cleanString(payload.title);
  const summary = cleanString(payload.summary || "");
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const status = payload.status === "published" ? "published" : "draft";

  if (!title) throw new HttpError("Give this thought a title.");
  if (title.length > 160) throw new HttpError("Keep the title under 160 characters.");
  if (summary.length > 320) throw new HttpError("Keep the summary under 320 characters.");
  if (!body) throw new HttpError("Write something before saving.");
  if (body.length > 100000) throw new HttpError("Keep the post under 100,000 characters.");
  return { title, summary, body, status };
}

export async function uniqueSlug(db, title, currentId = null) {
  const base = slugify(title) || "thought";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const row = currentId === null
      ? await db.prepare("SELECT id FROM writing_posts WHERE slug = ?").bind(slug).first()
      : await db.prepare("SELECT id FROM writing_posts WHERE slug = ? AND id != ?")
        .bind(slug, currentId).first();
    if (!row) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function postForClient(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function cleanString(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72)
    .replace(/-$/g, "");
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return null;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
