// Shared helpers: database, passwords, sessions, permissions.
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || '');

// Which saved data each role may read and write.
const ALL_KEYS = [
  'uphs_scan_logs', 'uphs_employees', 'uphs_staff_ic_records',
  'uphs_pto_records', 'uphs_attendance_tracker', 'uphs_course_sections'
];
const ROLE_KEYS = {
  'Administrator': ALL_KEYS,
  'Standard User': ALL_KEYS,
  'Gate Keeper': ['uphs_scan_logs', 'uphs_employees']
};
const ROLES = Object.keys(ROLE_KEYS);

// ---- Database tables are created automatically on first request ----
let schemaPromise = null;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`create table if not exists users (
        id text primary key,
        username text unique not null,
        name text not null,
        role text not null,
        password_hash text not null,
        failed_attempts int not null default 0,
        locked_until timestamptz,
        created_at timestamptz not null default now()
      )`;
      await sql`create table if not exists app_data (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now()
      )`;
    })().catch((e) => { schemaPromise = null; throw e; });
  }
  return schemaPromise;
}

// ---- Passwords (scrypt, built into Node, no extra package) ----
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  try {
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) { return false; }
}
const DUMMY_HASH = hashPassword('not-a-real-password'); // keeps timing similar for unknown usernames

// ---- Sessions (signed cookie, 12 hours) ----
const SESSION_HOURS = 12;
function sign(payload) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
}
function makeSessionCookie(uid) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString('base64url');
  const value = payload + '.' + sign(payload);
  return `sid=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
}
function clearSessionCookie() {
  return 'sid=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}
function readSessionUserId(req) {
  const cookie = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('sid='));
  if (!cookie) return null;
  const [payload, sig] = cookie.slice(4).split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data.uid : null;
  } catch (e) { return null; }
}
// Looks the user up on every request, so role changes and deletions take effect immediately.
async function currentUser(req) {
  const uid = readSessionUserId(req);
  if (!uid) return null;
  const rows = await sql`select id, username, name, role from users where id = ${uid}`;
  return rows[0] || null;
}

// ---- Wrapper for every API route ----
function route(handler) {
  return async (req, res) => {
    try {
      if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
        return res.status(500).json({ error: 'Server is not configured: set DATABASE_URL and SESSION_SECRET.' });
      }
      await ensureSchema();
      return await handler(req, res);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  };
}

module.exports = {
  sql, ROLES, ROLE_KEYS, hashPassword, verifyPassword, DUMMY_HASH,
  makeSessionCookie, clearSessionCookie, currentUser, route
};
