const { sql, openPool, cleanUid } = require('../_lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const b = req.body || {};
  const uid = cleanUid(b.uid || req.query.uid);
  const sessionId = String(b.session_id || '').trim();
  const position = parseInt(b.position, 10);
  const marked = b.marked ? 1 : 0;
  if (!sessionId || !position) return res.status(400).json({ error: 'session_id e position são obrigatórios.' });

  let pool;
  try {
    pool = await openPool();
    await pool.request()
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('position', sql.Int, position)
      .input('marked', sql.Bit, marked)
      .query(`
        UPDATE sq SET marked_for_review=@marked
        FROM dbo.exam_session_questions sq
        INNER JOIN dbo.exam_sessions s ON s.session_id=sq.session_id
        WHERE sq.session_id=@session_id AND sq.position=@position
          AND s.user_id=@uid AND s.status=N'in_progress';
      `);
    return res.status(200).json({ ok: true, marked: !!marked });
  } catch (e) {
    console.error('[exam/mark]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
