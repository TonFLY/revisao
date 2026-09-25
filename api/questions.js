const { sql, openPool, cleanUid, cleanExam } = require('../lib/db');

function jsonText(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
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
      // Backward compatible: the old Study/Decoreba app receives only legacy questions.
      // Use ?origin=all or ?origin=real for richer banks.
      const origin = String(req.query.origin || 'legacy').toLowerCase();
      const request = pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), exam);

      let originWhere = "AND ISNULL(origin, N'legacy') <> N'real'";
      if (origin === 'all') originWhere = '';
      if (origin === 'real') originWhere = "AND origin = N'real'";

      const r = await request.query(`
        SELECT *
        FROM dbo.dp300_questions
        WHERE user_id=@uid AND exam=@exam
        ${originWhere}
        ORDER BY created_at DESC, id DESC;
      `);
      return res.status(200).json(r.recordset);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const qtype = String(b.question_type || 'single_choice').slice(0, 40);
      const origin = String(b.origin || 'legacy').slice(0, 20);

      const r = await pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), cleanExam(b.exam || exam))
        .input('question', sql.NVarChar(sql.MAX), String(b.question || ''))
        .input('option_a', sql.NVarChar(sql.MAX), b.option_a ?? null)
        .input('option_b', sql.NVarChar(sql.MAX), b.option_b ?? null)
        .input('option_c', sql.NVarChar(sql.MAX), b.option_c ?? null)
        .input('option_d', sql.NVarChar(sql.MAX), b.option_d ?? null)
        .input('correct', sql.Char(1), b.correct ? String(b.correct).toUpperCase().slice(0, 1) : null)
        .input('explanation', sql.NVarChar(sql.MAX), b.explanation || '')
        .input('topic', sql.NVarChar(200), b.topic || 'Outro')
        .input('difficulty', sql.NVarChar(40), b.difficulty || 'medio')
        .input('status', sql.NVarChar(40), b.status || 'pendente')
        .input('why_correct', sql.NVarChar(sql.MAX), b.why_correct ?? null)
        .input('why_a_wrong', sql.NVarChar(sql.MAX), b.why_a_wrong ?? null)
        .input('why_b_wrong', sql.NVarChar(sql.MAX), b.why_b_wrong ?? null)
        .input('why_c_wrong', sql.NVarChar(sql.MAX), b.why_c_wrong ?? null)
        .input('why_d_wrong', sql.NVarChar(sql.MAX), b.why_d_wrong ?? null)
        .input('exam_keyword', sql.NVarChar(1000), b.exam_keyword ?? null)
        .input('memory_rule', sql.NVarChar(sql.MAX), b.memory_rule ?? null)
        .input('trap', sql.NVarChar(sql.MAX), b.trap ?? null)
        .input('source_name', sql.NVarChar(400), b.source_name ?? null)
        .input('source_url', sql.NVarChar(4000), b.source_url ?? null)
        .input('verified', sql.Bit, b.verified ? 1 : 0)
        .input('question_type', sql.NVarChar(40), qtype)
        .input('origin', sql.NVarChar(20), origin)
        .input('domain_code', sql.NVarChar(40), b.domain_code ?? null)
        .input('interaction_json', sql.NVarChar(sql.MAX), jsonText(b.interaction_json ?? b.interaction))
        .input('correct_json', sql.NVarChar(sql.MAX), jsonText(b.correct_json ?? b.correct_payload))
        .input('case_id', sql.NVarChar(100), b.case_id ?? null)
        .input('case_json', sql.NVarChar(sql.MAX), jsonText(b.case_json ?? b.case_data))
        .input('points', sql.Int, Math.max(1, parseInt(b.points || 1, 10)))
        .input('realism_level', sql.TinyInt, Math.min(5, Math.max(1, parseInt(b.realism_level || 1, 10))))
        .query(`
          INSERT INTO dbo.dp300_questions
          (
            user_id,exam,question,option_a,option_b,option_c,option_d,correct,
            explanation,topic,difficulty,status,
            why_correct,why_a_wrong,why_b_wrong,why_c_wrong,why_d_wrong,
            exam_keyword,memory_rule,trap,source_name,source_url,verified,
            question_type,origin,domain_code,interaction_json,correct_json,
            case_id,case_json,points,realism_level
          )
          OUTPUT INSERTED.*
          VALUES
          (
            @uid,@exam,@question,@option_a,@option_b,@option_c,@option_d,@correct,
            @explanation,@topic,@difficulty,@status,
            @why_correct,@why_a_wrong,@why_b_wrong,@why_c_wrong,@why_d_wrong,
            @exam_keyword,@memory_rule,@trap,@source_name,@source_url,@verified,
            @question_type,@origin,@domain_code,@interaction_json,@correct_json,
            @case_id,@case_json,@points,@realism_level
          );
        `);
      return res.status(201).json(r.recordset[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[questions]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
