module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const domain = String(process.env.AUTH0_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const resource = String(process.env.MCP_SERVER_URL || '').replace(/\/+$/, '');

  if (!domain || !resource) {
    return res.status(500).json({
      error: 'AUTH0_DOMAIN e MCP_SERVER_URL são obrigatórios.',
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    resource,
    authorization_servers: [`https://${domain}/`],
    scopes_supported: ['study:read'],
    resource_documentation: resource.replace(/\/api\/mcp$/, '/'),
  });
};
