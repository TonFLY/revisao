const { sql, openPool, cleanUid, cleanExam } = require('../lib/db');
const { evaluateQuestion } = require('../lib/evaluator');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const uid = cleanUid(req.query.uid);
  const exam = cleanExam(req.query.exam);
  const b = req.body || {};
  const questionId = parseInt(b.question_id, 10);
  if (!questionId) return res.status(400).json({ error: 'question_id inválido' });

  const rawAnswer = b.answer ?? (b.selected_answer ? { selected: String(b.selected_answer).toUpperCase() } : null);
  if (rawAnswer == null) return res.status(400).json({ error: 'Resposta ausente.' });

  let pool;
  let tx;
  try {
    pool = await openPool();
    tx = new sql.Transaction(pool);
    await tx.begin();

    const qr = await new sql.Request(tx)
      .input('id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`SELECT * FROM dbo.dp300_questions WHERE id=@id AND user_id=@uid AND exam=@exam;`);

    if (!qr.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Questão não encontrada para esse usuário/exame.' });
    }

    const q = qr.recordset[0];
    const evaluation = evaluateQuestion(q, rawAnswer);
    const type = q.question_type || 'single_choice';
    const selectedLetter = type === 'single_choice' ? String(rawAnswer.selected || '').toUpperCase().slice(0,1) || null : null;
    const correctLetter = type === 'single_choice' ? String(q.correct || '').toUpperCase().slice(0,1) || null : null;

    await new sql.Request(tx)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .input('selected_answer', sql.Char(1), selectedLetter)
      .input('correct_answer', sql.Char(1), correctLetter)
      .input('selected_json', sql.NVarChar(sql.MAX), JSON.stringify(rawAnswer))
      .input('correct_json', sql.NVarChar(sql.MAX), JSON.stringify(evaluation.correctPayload))
      .input('question_type', sql.NVarChar(40), type)
      .input('is_correct', sql.Bit, evaluation.isCorrect ? 1 : 0)
      .input('points_earned', sql.Decimal(10,2), evaluation.pointsEarned)
      .input('points_max', sql.Decimal(10,2), evaluation.pointsMax)
      .input('study_mode', sql.NVarChar(30), String(b.study_mode || 'study').slice(0,30))
      .input('response_ms', sql.Int, Number.isFinite(Number(b.response_ms)) ? Math.max(0, Math.floor(Number(b.response_ms))) : null)
      .query(`
        INSERT INTO dbo.question_attempts
        (question_id,user_id,exam,selected_answer,correct_answer,selected_json,correct_json,
         question_type,is_correct,points_earned,points_max,study_mode,response_ms)
        VALUES
        (@question_id,@uid,@exam,@selected_answer,@correct_answer,@selected_json,@correct_json,
         @question_type,@is_correct,@points_earned,@points_max,@study_mode,@response_ms);
      `);

    const rr = await new sql.Request(tx)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT TOP (2) is_correct, answered_at
        FROM dbo.question_attempts
        WHERE question_id=@question_id AND user_id=@uid AND exam=@exam
        ORDER BY answered_at DESC, attempt_id DESC;
      `);

    const recent = rr.recordset;
    let status = 'revisar';
    if (recent.length >= 2 && recent[0].is_correct && recent[1].is_correct) {
      const hours = (new Date(recent[0].answered_at) - new Date(recent[1].answered_at)) / 3600000;
      status = hours >= 24 ? 'acertei' : 'revisar';
    } else if (recent.length >= 2 && !recent[0].is_correct && !recent[1].is_correct) {
      status = 'errei';
    }

    await new sql.Request(tx)
      .input('id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .input('status', sql.NVarChar(40), status)
      .query(`
        UPDATE dbo.dp300_questions
        SET status=@status, last_reviewed=GETDATE(), updated_at=GETDATE()
        WHERE id=@id AND user_id=@uid AND exam=@exam;
      `);

    const sr = await new sql.Request(tx)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT COUNT(*) attempts,
               SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) correct_count,
               SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) wrong_count,
               CAST(100.0*SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0) AS DECIMAL(5,2)) accuracy_pct
        FROM dbo.question_attempts
        WHERE question_id=@question_id AND user_id=@uid AND exam=@exam;
      `);

    await tx.commit();
    const stats = sr.recordset[0] || {};

    return res.status(200).json({
      ok: true,
      question_id: questionId,
      question_type: type,
      selected_answer: selectedLetter,
      correct_answer: correctLetter,
      selected: rawAnswer,
      correct_payload: evaluation.correctPayload,
      is_correct: evaluation.isCorrect,
      points_earned: evaluation.pointsEarned,
      points_max: evaluation.pointsMax,
      status,
      history: {
        attempts: stats.attempts || 0,
        correct: stats.correct_count || 0,
        wrong: stats.wrong_count || 0,
        accuracy_pct: Number(stats.accuracy_pct || 0),
      },
      explanation: {
        explanation: q.explanation || null,
        why_correct: q.why_correct || null,
        memory_rule: q.memory_rule || null,
        trap: q.trap || null,
      },
    });
  } catch (e) {
    if (tx) { try { await tx.rollback(); } catch (_) {} }
    console.error('[attempts]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
