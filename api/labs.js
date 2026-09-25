const { sql, openPool, cleanUid, cleanExam } = require('../lib/db');

function cleanLabId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 120);
}
function cleanStatus(value) {
  const v = String(value || '').toLowerCase();
  return ['not_started','in_progress','completed'].includes(v) ? v : 'in_progress';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const uid = cleanUid(req.query.uid);
  const exam = cleanExam(req.query.exam);
  let pool;

  try {
    pool = await openPool();

    if (req.method === 'GET') {
      const r = await pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), exam)
        .query(`
          SELECT lab_id,status,completed,started_at,completed_at,last_opened_at,notes,updated_at
          FROM dbo.dp300_lab_progress
          WHERE user_id=@uid AND exam=@exam
          ORDER BY updated_at DESC;
        `);
      return res.status(200).json({ items: r.recordset });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const labId = cleanLabId(b.lab_id);
      if (!labId) return res.status(400).json({ error: 'lab_id obrigatório.' });

      const action = String(b.action || 'status').toLowerCase();
      let status = cleanStatus(b.status);
      let completed = status === 'completed' ? 1 : 0;

      if (action === 'open') {
        status = 'in_progress';
        completed = 0;
      } else if (action === 'complete') {
        status = 'completed';
        completed = 1;
      } else if (action === 'reset') {
        status = 'not_started';
        completed = 0;
      }

      const notes = b.notes == null ? null : String(b.notes).slice(0, 4000);

      const r = await pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), exam)
        .input('lab_id', sql.NVarChar(120), labId)
        .input('status', sql.NVarChar(20), status)
        .input('completed', sql.Bit, completed)
        .input('notes', sql.NVarChar(4000), notes)
        .input('is_open', sql.Bit, action === 'open' ? 1 : 0)
        .query(`
          MERGE dbo.dp300_lab_progress AS T
          USING (SELECT @uid AS user_id, @exam AS exam, @lab_id AS lab_id) AS S
          ON T.user_id=S.user_id AND T.exam=S.exam AND T.lab_id=S.lab_id
          WHEN MATCHED THEN UPDATE SET
            status=@status,
            completed=@completed,
            started_at=CASE
              WHEN @status=N'not_started' THEN NULL
              WHEN T.started_at IS NULL THEN SYSUTCDATETIME()
              ELSE T.started_at END,
            completed_at=CASE
              WHEN @completed=1 THEN COALESCE(T.completed_at,SYSUTCDATETIME())
              ELSE NULL END,
            last_opened_at=CASE WHEN @is_open=1 THEN SYSUTCDATETIME() ELSE T.last_opened_at END,
            notes=COALESCE(@notes,T.notes),
            updated_at=SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            (user_id,exam,lab_id,status,completed,started_at,completed_at,last_opened_at,notes,updated_at)
          VALUES
            (@uid,@exam,@lab_id,@status,@completed,
             CASE WHEN @status=N'not_started' THEN NULL ELSE SYSUTCDATETIME() END,
             CASE WHEN @completed=1 THEN SYSUTCDATETIME() ELSE NULL END,
             CASE WHEN @is_open=1 THEN SYSUTCDATETIME() ELSE NULL END,
             @notes,SYSUTCDATETIME())
          OUTPUT INSERTED.*;
        `);

      return res.status(200).json(r.recordset[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[labs]', e);
    if (/dp300_lab_progress/i.test(String(e.message || ''))) {
      return res.status(503).json({
        error: 'Tabela dbo.dp300_lab_progress ainda não existe. Execute sql/003_labs_progress.sql.'
      });
    }
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
