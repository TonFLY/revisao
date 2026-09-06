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
    encrypt               : false,
    trustServerCertificate: true,
    enableArithAbort      : true,
  }
};

function normalizeExam(value) {
  return ['DP-300', 'DP-800'].includes(value) ? value : 'DP-300';
}

function text(value) {
  return value == null ? '' : String(value);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DB_HOST) {
    return res.status(500).json({ error: 'Variáveis de ambiente DB_* não configuradas na Vercel.' });
  }

  const uid  = (req.query.uid || 'default').trim().toLowerCase().slice(0, 50);
  const exam = normalizeExam((req.query.exam || 'DP-300').trim().slice(0, 20));

  let pool;

  try {
    pool = await sql.connect(config);

    if (req.method === 'GET') {
      const r = await pool.request()
        .input('uid',  sql.NVarChar(50), uid)
        .input('exam', sql.NVarChar(20), exam)
        .query(`
          SELECT *
          FROM dbo.dp300_questions
          WHERE user_id = @uid
            AND exam = @exam
          ORDER BY created_at DESC
        `);

      return res.status(200).json(r.recordset);
    }

    if (req.method === 'POST') {
      const {
        question, option_a, option_b, option_c, option_d, correct,
        explanation,
        why_correct, why_a_wrong, why_b_wrong, why_c_wrong, why_d_wrong,
        exam_keyword, memory_rule, trap,
        source_name, source_url, verified,
        topic, difficulty, status
      } = req.body || {};

      if (!question || !option_a || !option_b || !option_c || !option_d || !topic) {
        return res.status(400).json({ error: 'Questão, alternativas e tópico são obrigatórios.' });
      }

      const correctLetter = String(correct || 'A').toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correctLetter)) {
        return res.status(400).json({ error: 'Resposta correta deve ser A, B, C ou D.' });
      }

      const r = await pool.request()
        .input('uid',          sql.NVarChar(50), uid)
        .input('exam',         sql.NVarChar(20), exam)
        .input('question',     sql.NVarChar(sql.MAX), text(question))
        .input('option_a',     sql.NVarChar(sql.MAX), text(option_a))
        .input('option_b',     sql.NVarChar(sql.MAX), text(option_b))
        .input('option_c',     sql.NVarChar(sql.MAX), text(option_c))
        .input('option_d',     sql.NVarChar(sql.MAX), text(option_d))
        .input('correct',      sql.Char(1), correctLetter)
        .input('explanation',  sql.NVarChar(sql.MAX), text(explanation))
        .input('why_correct',  sql.NVarChar(sql.MAX), text(why_correct))
        .input('why_a_wrong',  sql.NVarChar(sql.MAX), text(why_a_wrong))
        .input('why_b_wrong',  sql.NVarChar(sql.MAX), text(why_b_wrong))
        .input('why_c_wrong',  sql.NVarChar(sql.MAX), text(why_c_wrong))
        .input('why_d_wrong',  sql.NVarChar(sql.MAX), text(why_d_wrong))
        .input('exam_keyword', sql.NVarChar(500), text(exam_keyword).slice(0, 500))
        .input('memory_rule',  sql.NVarChar(sql.MAX), text(memory_rule))
        .input('trap',         sql.NVarChar(sql.MAX), text(trap))
        .input('source_name',  sql.NVarChar(200), text(source_name).slice(0, 200))
        .input('source_url',   sql.NVarChar(2000), text(source_url).slice(0, 2000))
        .input('verified',     sql.Bit, verified ? 1 : 0)
        .input('topic',        sql.NVarChar(100), text(topic).slice(0, 100))
        .input('difficulty',   sql.NVarChar(20), text(difficulty || 'medio').slice(0, 20))
        .input('status',       sql.NVarChar(20), text(status || 'pendente').slice(0, 20))
        .query(`
          INSERT INTO dbo.dp300_questions
          (
            user_id, exam, question,
            option_a, option_b, option_c, option_d,
            correct, explanation,
            why_correct, why_a_wrong, why_b_wrong, why_c_wrong, why_d_wrong,
            exam_keyword, memory_rule, trap,
            source_name, source_url, verified,
            topic, difficulty, status
          )
          OUTPUT INSERTED.*
          VALUES
          (
            @uid, @exam, @question,
            @option_a, @option_b, @option_c, @option_d,
            @correct, @explanation,
            @why_correct, @why_a_wrong, @why_b_wrong, @why_c_wrong, @why_d_wrong,
            @exam_keyword, @memory_rule, @trap,
            @source_name, @source_url, @verified,
            @topic, @difficulty, @status
          )
        `);

      return res.status(201).json(r.recordset[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[questions] error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
