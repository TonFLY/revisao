module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return res.status(200).json({
    ok: true,
    service: 'revisao-mcp',
    mode: 'read-only',
    oauth: Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE),
  });
};
