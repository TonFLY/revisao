const { sql, openPool, cleanUid } = require('../_lib/db');
const { publicQuestion, parseJson } = require('../_lib/evaluator');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  const sessionId = String(req.query.session_id || '').trim();
  const uid = cleanUid(req.query.uid);
  if (!sessionId) return res.status(400).json({ error: 'session_id obrigatório' });

  let pool;
  try {
    pool = await openPool();
    const sr = await pool.request()
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('uid', sql.NVarChar(100), uid)
      .query(`
        SELECT *, DATEADD(MINUTE, duration_minutes, started_at) AS expires_at
        FROM dbo.exam_sessions
        WHERE session_id=@session_id AND user_id=@uid;
      `);
    if (!sr.recordset.length) return res.status(404).json({ error: 'Sessão não encontrada.' });
    const session = sr.recordset[0];
    const reveal = session.status !== 'in_progress';

    const qr = await pool.request()
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT sq.position, sq.answer_json, sq.marked_for_review, sq.answered_at,
               sq.response_ms, sq.is_correct, sq.points_earned, sq.points_max,
               q.*
        FROM dbo.exam_session_questions sq
        INNER JOIN dbo.dp300_questions q ON q.id=sq.question_id
        WHERE sq.session_id=@session_id
        ORDER BY sq.position;
      `);

    const questions = qr.recordset.map(row => {
      const q = publicQuestion(row, reveal);
      q.position = row.position;
      q.saved_answer = parseJson(row.answer_json, null);
      q.marked_for_review = !!row.marked_for_review;
      q.answered_at = row.answered_at;
      q.response_ms = row.response_ms;
      if (reveal) {
        q.result = {
          is_correct: row.is_correct == null ? null : !!row.is_correct,
          points_earned: row.points_earned,
          points_max: row.points_max,
        };
      }
      return q;
    });

    return res.status(200).json({
      session: {
        session_id: session.session_id,
        user_id: session.user_id,
        exam: session.exam,
        status: session.status,
        question_count: session.question_count,
        duration_minutes: session.duration_minutes,
        started_at: session.started_at,
        expires_at: session.expires_at,
        submitted_at: session.submitted_at,
        points_earned: session.points_earned,
        points_max: session.points_max,
        raw_score_pct: session.raw_score_pct,
      },
      questions,
    });
  } catch (e) {
    console.error('[exam/session]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
