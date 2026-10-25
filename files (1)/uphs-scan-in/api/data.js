const { sql, ROLE_KEYS, currentUser, route } = require('../lib/shared');

module.exports = route(async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  const allowed = ROLE_KEYS[user.role] || [];

  // GET /api/data  -> everything this role may see
  if (req.method === 'GET') {
    const rows = await sql`select key, value from app_data where key = any(${allowed})`;
    const out = {};
    rows.forEach((r) => { out[r.key] = r.value; });
    return res.status(200).json(out);
  }

  // PUT /api/data?key=uphs_employees  (body = the full JSON array)
  if (req.method === 'PUT') {
    const key = req.query.key;
    if (!allowed.includes(key)) return res.status(403).json({ error: 'Not allowed.' });
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be a JSON array.' });
    await sql`insert into app_data (key, value) values (${key}, ${JSON.stringify(req.body)}::jsonb)
              on conflict (key) do update set value = excluded.value, updated_at = now()`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
});
