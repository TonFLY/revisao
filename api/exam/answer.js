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
  if (!sessionId || !position) return res.status(400).json({ error: 'session_id e position são obrigatórios.' });
  if (b.answer == null) return res.status(400).json({ error: 'answer é obrigatório.' });

  let pool;
  try {
    pool = await openPool();
    const r = await pool.request()
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('position', sql.Int, position)
      .input('answer_json', sql.NVarChar(sql.MAX), JSON.stringify(b.answer))
      .input('response_ms', sql.Int, Number.isFinite(Number(b.response_ms)) ? Math.max(0, Math.floor(Number(b.response_ms))) : null)
      .query(`
        UPDATE sq
        SET answer_json=@answer_json,
            answered_at=SYSUTCDATETIME(),
            response_ms=@response_ms
        FROM dbo.exam_session_questions sq
        INNER JOIN dbo.exam_sessions s ON s.session_id=sq.session_id
        WHERE sq.session_id=@session_id AND sq.position=@position
          AND s.user_id=@uid AND s.status=N'in_progress';
        SELECT @@ROWCOUNT AS affected;
      `);
    if (!r.recordset[0]?.affected) return res.status(409).json({ error: 'Sessão encerrada ou questão inválida.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[exam/answer]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
