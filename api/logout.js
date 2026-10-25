const { clearSessionCookie } = require('../lib/shared');

module.exports = (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(200).json({ ok: true });
};
