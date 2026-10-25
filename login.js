const crypto = require('crypto');
const { sql, hashPassword, verifyPassword, DUMMY_HASH, makeSessionCookie, route } = require('../lib/shared');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = route(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) return res.status(400).json({ error: 'Enter a username and password.' });

  // First run only: create the first Administrator from the ADMIN_USERNAME / ADMIN_PASSWORD settings.
  const [{ n }] = await sql`select count(*)::int as n from users`;
  const envUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  if (n === 0 && envUser && process.env.ADMIN_PASSWORD &&
      username === envUser && safeEqual(password, process.env.ADMIN_PASSWORD)) {
    await sql`insert into users (id, username, name, role, password_hash)
              values (${'usr_' + crypto.randomUUID()}, ${username}, 'System Administrator', 'Administrator', ${hashPassword(password)})`;
  }

  const rows = await sql`select * from users where username = ${username}`;
  const user = rows[0];

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` });
  }

  const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH) && !!user;
  if (!ok) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await sql`update users set failed_attempts = 0, locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval where id = ${user.id}`;
      } else {
        await sql`update users set failed_attempts = ${attempts} where id = ${user.id}`;
      }
    }
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  await sql`update users set failed_attempts = 0, locked_until = null where id = ${user.id}`;
  res.setHeader('Set-Cookie', makeSessionCookie(user.id));
  return res.status(200).json({ name: user.name, role: user.role });
});
