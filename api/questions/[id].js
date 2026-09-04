const sql = require('mssql');

const config = {
  server          : process.env.DB_HOST,
  port            : parseInt(process.env.DB_PORT || '1433'),
  database        : process.env.DB_NAME,
  user            : process.env.DB_USER,
  password        : process.env.DB_PASSWORD,
  connectionTimeout: 8000,
  requestTimeout  : 8000,
  options: {
    encrypt              : false,
    trustServerCertificate: true,
    enableArithAbort     : true,
  }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DB_HOST) {
    return res.status(500).json({ error: 'Variáveis de ambiente DB_* não configuradas na Vercel.' });
  }

  const id  = parseInt(req.query.id);
  const uid = (req.query.uid || 'default').trim().toLowerCase().slice(0, 50);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  let pool;
  try {
    pool = await sql.connect(config);

    if (req.method === 'PUT') {
      const { question, option_a, option_b, option_c, option_d, correct, explanation, topic, difficulty, status } = req.body;
      const r = await pool.request()
        .input('id',          sql.Int,      id)
        .input('uid',         sql.NVarChar, uid)
        .input('question',    sql.NVarChar, question)
        .input('option_a',    sql.NVarChar, option_a)
        .input('option_b',    sql.NVarChar, option_b)
        .input('option_c',    sql.NVarChar, option_c)
        .input('option_d',    sql.NVarChar, option_d)
        .input('correct',     sql.Char,     (correct || 'A').toUpperCase())
        .input('explanation', sql.NVarChar, explanation || '')
        .input('topic',       sql.NVarChar, topic)
        .input('difficulty',  sql.NVarChar, difficulty)
        .input('status',      sql.NVarChar, status)
        .query(`UPDATE dp300_questions
                SET question=@question, option_a=@option_a, option_b=@option_b,
                    option_c=@option_c, option_d=@option_d, correct=@correct,
                    explanation=@explanation, topic=@topic, difficulty=@difficulty,
                    status=@status, updated_at=GETDATE(), last_reviewed=GETDATE()
                OUTPUT INSERTED.*
                WHERE id=@id AND user_id=@uid`);
      return res.status(200).json(r.recordset[0]);
    }

    if (req.method === 'DELETE') {
      await pool.request()
        .input('id',  sql.Int,      id)
        .input('uid', sql.NVarChar, uid)
        .query('DELETE FROM dp300_questions WHERE id=@id AND user_id=@uid');
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('[questions/id] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
