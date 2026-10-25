const { currentUser, route } = require('../lib/shared');

module.exports = route(async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  return res.status(200).json({ name: user.name, role: user.role, username: user.username });
});
