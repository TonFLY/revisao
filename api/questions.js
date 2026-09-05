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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DB_HOST) {
    return res.status(500).json({ error: 'Variáveis de ambiente DB_* não configuradas na Vercel.' });
  }

  const uid  = (req.query.uid  || 'default').trim().toLowerCase().slice(0, 50);
  const exam = (req.query.exam || 'DP-300').trim().slice(0, 20);

  let pool;
  try {
    pool = await sql.connect(config);

    if (req.method === 'GET') {
      const r = await pool.request()
        .input('uid',  sql.NVarChar, uid)
        .input('exam', sql.NVarChar, exam)
        .query('SELECT * FROM dp300_questions WHERE user_id=@uid AND exam=@exam ORDER BY created_at DESC');
      return res.status(200).json(r.recordset);
    }

    if (req.method === 'POST') {
      const { question, option_a, option_b, option_c, option_d, correct, explanation, topic, difficulty } = req.body;
      const r = await pool.request()
        .input('uid',         sql.NVarChar, uid)
        .input('exam',        sql.NVarChar, exam)
        .input('question',    sql.NVarChar, question)
        .input('option_a',    sql.NVarChar, option_a)
        .input('option_b',    sql.NVarChar, option_b)
        .input('option_c',    sql.NVarChar, option_c)
        .input('option_d',    sql.NVarChar, option_d)
        .input('correct',     sql.Char,     (correct || 'A').toUpperCase())
        .input('explanation', sql.NVarChar, explanation || '')
        .input('topic',       sql.NVarChar, topic)
        .input('difficulty',  sql.NVarChar, difficulty || 'medio')
        .query(`INSERT INTO dp300_questions
                  (user_id,exam,question,option_a,option_b,option_c,option_d,correct,explanation,topic,difficulty)
                OUTPUT INSERTED.*
                VALUES (@uid,@exam,@question,@option_a,@option_b,@option_c,@option_d,@correct,@explanation,@topic,@difficulty)`);
      return res.status(201).json(r.recordset[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('[questions] error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
