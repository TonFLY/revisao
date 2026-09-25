const { sql, openPool, cleanUid, cleanExam } = require('../_lib/db');

function jsonText(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const FIELDS = [
  ['question', sql.NVarChar(sql.MAX)],
  ['option_a', sql.NVarChar(sql.MAX)],
  ['option_b', sql.NVarChar(sql.MAX)],
  ['option_c', sql.NVarChar(sql.MAX)],
  ['option_d', sql.NVarChar(sql.MAX)],
  ['correct', sql.Char(1)],
  ['explanation', sql.NVarChar(sql.MAX)],
  ['topic', sql.NVarChar(200)],
  ['difficulty', sql.NVarChar(40)],
  ['status', sql.NVarChar(40)],
  ['why_correct', sql.NVarChar(sql.MAX)],
  ['why_a_wrong', sql.NVarChar(sql.MAX)],
  ['why_b_wrong', sql.NVarChar(sql.MAX)],
  ['why_c_wrong', sql.NVarChar(sql.MAX)],
  ['why_d_wrong', sql.NVarChar(sql.MAX)],
  ['exam_keyword', sql.NVarChar(1000)],
  ['memory_rule', sql.NVarChar(sql.MAX)],
  ['trap', sql.NVarChar(sql.MAX)],
  ['source_name', sql.NVarChar(400)],
  ['source_url', sql.NVarChar(4000)],
  ['verified', sql.Bit],
  ['question_type', sql.NVarChar(40)],
  ['origin', sql.NVarChar(20)],
  ['domain_code', sql.NVarChar(40)],
  ['interaction_json', sql.NVarChar(sql.MAX)],
  ['correct_json', sql.NVarChar(sql.MAX)],
  ['case_id', sql.NVarChar(100)],
  ['case_json', sql.NVarChar(sql.MAX)],
  ['points', sql.Int],
  ['realism_level', sql.TinyInt],
];

function normalized(q, defaultExam) {
  const questionType = String(q.question_type || 'single_choice');
  return {
    exam: cleanExam(q.exam || defaultExam),
    question: String(q.question || ''),
    option_a: q.option_a ?? null,
    option_b: q.option_b ?? null,
    option_c: q.option_c ?? null,
    option_d: q.option_d ?? null,
    correct: q.correct ? String(q.correct).toUpperCase().slice(0, 1) : null,
    explanation: q.explanation || '',
    topic: q.topic || 'Outro',
    difficulty: q.difficulty || 'medio',
    status: q.status || 'pendente',
    why_correct: q.why_correct ?? null,
    why_a_wrong: q.why_a_wrong ?? null,
    why_b_wrong: q.why_b_wrong ?? null,
    why_c_wrong: q.why_c_wrong ?? null,
    why_d_wrong: q.why_d_wrong ?? null,
    exam_keyword: q.exam_keyword ?? null,
    memory_rule: q.memory_rule ?? null,
    trap: q.trap ?? null,
    source_name: q.source_name ?? null,
    source_url: q.source_url ?? null,
    verified: q.verified ? 1 : 0,
    question_type: questionType,
    origin: q.origin || (questionType === 'single_choice' ? 'legacy' : 'real'),
    domain_code: q.domain_code ?? null,
    interaction_json: jsonText(q.interaction_json ?? q.interaction),
    correct_json: jsonText(q.correct_json ?? q.correct_payload),
    case_id: q.case_id ?? null,
    case_json: jsonText(q.case_json ?? q.case_data),
    points: Math.max(1, parseInt(q.points || 1, 10)),
    realism_level: Math.min(5, Math.max(1, parseInt(q.realism_level || 1, 10))),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const uid = cleanUid(req.query.uid);
  const defaultExam = cleanExam(req.query.exam);
  const input = Array.isArray(req.body) ? req.body : req.body?.questions;
  if (!Array.isArray(input) || !input.length) {
    return res.status(400).json({ error: 'Envie { questions: [...] }.' });
  }
  if (input.length > 1000) {
    return res.status(400).json({ error: 'Máximo de 1000 questões por importação.' });
  }

  const questions = input.map(q => normalized(q, defaultExam));
  let pool;
  let inserted = 0;

  try {
    pool = await openPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const chunkSize = 45;
      for (let offset = 0; offset < questions.length; offset += chunkSize) {
        const chunk = questions.slice(offset, offset + chunkSize);
        const request = new sql.Request(transaction);
        request.input('uid', sql.NVarChar(100), uid);
        const values = [];

        chunk.forEach((q, i) => {
          const n = offset + i;
          request.input(`exam${n}`, sql.NVarChar(40), q.exam);
          const names = ['@uid', `@exam${n}`];
          FIELDS.forEach(([field, type]) => {
            const param = `${field}${n}`;
            request.input(param, type, q[field]);
            names.push(`@${param}`);
          });
          values.push(`(${names.join(',')})`);
        });

        await request.query(`
          INSERT INTO dbo.dp300_questions
          (
            user_id, exam,
            ${FIELDS.map(([f]) => f).join(',')}
          )
          VALUES ${values.join(',')};
        `);
        inserted += chunk.length;
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return res.status(200).json({
      ok: true,
      received: questions.length,
      inserted,
      real: questions.filter(q => q.origin === 'real').length,
      legacy: questions.filter(q => q.origin !== 'real').length,
    });
  } catch (e) {
    console.error('[questions/import]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
