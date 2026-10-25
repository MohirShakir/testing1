const crypto = require('crypto');
const { sql, ROLES, hashPassword, currentUser, route } = require('../lib/shared');

module.exports = route(async (req, res) => {
  const me = await currentUser(req);
  if (!me) return res.status(401).json({ error: 'Not logged in.' });
  if (me.role !== 'Administrator') return res.status(403).json({ error: 'Administrators only.' });

  if (req.method === 'GET') {
    const rows = await sql`select id, username, name, role from users order by created_at`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const role = b.role;
    const id = typeof b.id === 'string' && b.id ? b.id : null;

    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: 'Username: 3-40 letters, numbers, . _ - only.' });
    if (!name || name.length > 100) return res.status(400).json({ error: 'Enter a full name (max 100 characters).' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    if ((!id || password) && password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

    try {
      if (id) {
        const rows = await sql`select role from users where id = ${id}`;
        if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
        if (rows[0].role === 'Administrator' && role !== 'Administrator') {
          const [{ n }] = await sql`select count(*)::int as n from users where role = 'Administrator' and id <> ${id}`;
          if (n === 0) return res.status(400).json({ error: 'At least one Administrator must remain.' });
        }
        if (password) {
          await sql`update users set username = ${username}, name = ${name}, role = ${role}, password_hash = ${hashPassword(password)}, failed_attempts = 0, locked_until = null where id = ${id}`;
        } else {
          await sql`update users set username = ${username}, name = ${name}, role = ${role} where id = ${id}`;
        }
      } else {
        await sql`insert into users (id, username, name, role, password_hash)
                  values (${'usr_' + crypto.randomUUID()}, ${username}, ${name}, ${role}, ${hashPassword(password)})`;
      }
    } catch (e) {
      if (e && e.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
      throw e;
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (id === me.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const rows = await sql`select role from users where id = ${id}`;
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    if (rows[0].role === 'Administrator') {
      const [{ n }] = await sql`select count(*)::int as n from users where role = 'Administrator' and id <> ${id}`;
      if (n === 0) return res.status(400).json({ error: 'Cannot delete the last Administrator.' });
    }
    await sql`delete from users where id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
});
