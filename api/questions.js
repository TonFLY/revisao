const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 8000,
  requestTimeout: 8000,
  options: { encrypt:false, trustServerCertificate:true, enableArithAbort:true }
};

function normalizeExam(value) {
  const v = String(value || '').trim().toUpperCase();
  return /^DP-\d{3}$/.test(v) ? v : null;
}
function text(value) { return value == null ? '' : String(value); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.DB_HOST) return res.status(500).json({ error:'Variáveis DB_* não configuradas.' });

  const uid = (req.query.uid || 'default').trim().toLowerCase().slice(0,50);
  const exam = normalizeExam(req.query.exam || 'DP-300');
  if (!exam) return res.status(400).json({ error:'Exame inválido. Use DP-XXX.' });

  let pool;
  try {
    pool = await sql.connect(config);
    if (req.method === 'GET') {
      const r = await pool.request().input('uid',sql.NVarChar(50),uid).input('exam',sql.NVarChar(20),exam)
        .query('SELECT * FROM dbo.dp300_questions WHERE user_id=@uid AND exam=@exam ORDER BY created_at DESC');
      return res.status(200).json(r.recordset);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.question || !b.option_a || !b.option_b || !b.option_c || !b.option_d || !b.topic)
        return res.status(400).json({ error:'Questão, alternativas e tópico são obrigatórios.' });
      const correct = String(b.correct || 'A').toUpperCase();
      if (!['A','B','C','D'].includes(correct)) return res.status(400).json({ error:'Resposta correta deve ser A, B, C ou D.' });

      const r = await pool.request()
        .input('uid',sql.NVarChar(50),uid).input('exam',sql.NVarChar(20),exam)
        .input('question',sql.NVarChar(sql.MAX),text(b.question))
        .input('option_a',sql.NVarChar(sql.MAX),text(b.option_a)).input('option_b',sql.NVarChar(sql.MAX),text(b.option_b))
        .input('option_c',sql.NVarChar(sql.MAX),text(b.option_c)).input('option_d',sql.NVarChar(sql.MAX),text(b.option_d))
        .input('correct',sql.Char(1),correct).input('explanation',sql.NVarChar(sql.MAX),text(b.explanation))
        .input('why_correct',sql.NVarChar(sql.MAX),text(b.why_correct)).input('why_a_wrong',sql.NVarChar(sql.MAX),text(b.why_a_wrong))
        .input('why_b_wrong',sql.NVarChar(sql.MAX),text(b.why_b_wrong)).input('why_c_wrong',sql.NVarChar(sql.MAX),text(b.why_c_wrong))
        .input('why_d_wrong',sql.NVarChar(sql.MAX),text(b.why_d_wrong)).input('exam_keyword',sql.NVarChar(500),text(b.exam_keyword).slice(0,500))
        .input('memory_rule',sql.NVarChar(sql.MAX),text(b.memory_rule)).input('trap',sql.NVarChar(sql.MAX),text(b.trap))
        .input('source_name',sql.NVarChar(200),text(b.source_name).slice(0,200)).input('source_url',sql.NVarChar(2000),text(b.source_url).slice(0,2000))
        .input('verified',sql.Bit,b.verified?1:0).input('topic',sql.NVarChar(100),text(b.topic).slice(0,100))
        .input('difficulty',sql.NVarChar(20),text(b.difficulty||'medio').slice(0,20)).input('status',sql.NVarChar(20),text(b.status||'pendente').slice(0,20))
        .query(`INSERT INTO dbo.dp300_questions
          (user_id,exam,question,option_a,option_b,option_c,option_d,correct,explanation,why_correct,why_a_wrong,why_b_wrong,why_c_wrong,why_d_wrong,exam_keyword,memory_rule,trap,source_name,source_url,verified,topic,difficulty,status)
          OUTPUT INSERTED.*
          VALUES (@uid,@exam,@question,@option_a,@option_b,@option_c,@option_d,@correct,@explanation,@why_correct,@why_a_wrong,@why_b_wrong,@why_c_wrong,@why_d_wrong,@exam_keyword,@memory_rule,@trap,@source_name,@source_url,@verified,@topic,@difficulty,@status)`);
      return res.status(201).json(r.recordset[0]);
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch(e) {
    console.error('[questions] error:',e);
    return res.status(500).json({ error:e.message });
  } finally { if (pool) await pool.close().catch(()=>{}); }
};
