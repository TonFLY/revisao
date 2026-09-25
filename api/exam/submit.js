const { sql, openPool, cleanUid } = require('../_lib/db');
const { evaluateQuestion, parseJson } = require('../_lib/evaluator');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const b = req.body || {};
  const uid = cleanUid(b.uid || req.query.uid);
  const sessionId = String(b.session_id || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'session_id obrigatório.' });

  let pool;
  let tx;
  try {
    pool = await openPool();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const sr = await new sql.Request(tx)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('uid', sql.NVarChar(100), uid)
      .query(`
        SELECT * FROM dbo.exam_sessions WITH (UPDLOCK,HOLDLOCK)
        WHERE session_id=@session_id AND user_id=@uid;
      `);
    if (!sr.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }
    const session = sr.recordset[0];
    if (session.status !== 'in_progress') {
      await tx.rollback();
      return res.status(409).json({ error: 'Sessão já foi finalizada.' });
    }

    const qr = await new sql.Request(tx)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT sq.position, sq.answer_json, sq.response_ms, sq.marked_for_review, q.*
        FROM dbo.exam_session_questions sq
        INNER JOIN dbo.dp300_questions q ON q.id=sq.question_id
        WHERE sq.session_id=@session_id
        ORDER BY sq.position;
      `);

    let totalEarned = 0;
    let totalMax = 0;
    const results = [];
    const batch = new sql.Request(tx);
    batch.input('session_id', sql.UniqueIdentifier, sessionId);
    batch.input('uid', sql.NVarChar(100), uid);
    batch.input('exam', sql.NVarChar(40), session.exam);
    let sqlBatch = '';

    qr.recordset.forEach((q, i) => {
      const answer = parseJson(q.answer_json, null);
      let ev;
      if (answer == null) {
        ev = {
          isCorrect: false,
          pointsEarned: 0,
          pointsMax: Math.max(1, Number(q.points || 1)),
          correctPayload: parseJson(q.correct_json, q.question_type === 'single_choice' ? { selected: q.correct } : null),
        };
      } else {
        ev = evaluateQuestion(q, answer);
      }

      totalEarned += Number(ev.pointsEarned || 0);
      totalMax += Number(ev.pointsMax || 0);

      batch.input(`pos${i}`, sql.Int, q.position);
      batch.input(`isc${i}`, sql.Bit, ev.isCorrect ? 1 : 0);
      batch.input(`pe${i}`, sql.Decimal(10,2), ev.pointsEarned);
      batch.input(`pm${i}`, sql.Decimal(10,2), ev.pointsMax);
      batch.input(`qid${i}`, sql.Int, q.id);

      sqlBatch += `
        UPDATE dbo.exam_session_questions
        SET is_correct=@isc${i}, points_earned=@pe${i}, points_max=@pm${i}
        WHERE session_id=@session_id AND position=@pos${i};
      `;

      if (answer != null) {
        const selectedLetter = q.question_type === 'single_choice' ? String(answer.selected || '').toUpperCase().slice(0,1) || null : null;
        const correctLetter = q.question_type === 'single_choice' ? String(q.correct || '').toUpperCase().slice(0,1) || null : null;
        batch.input(`sa${i}`, sql.Char(1), selectedLetter);
        batch.input(`ca${i}`, sql.Char(1), correctLetter);
        batch.input(`sj${i}`, sql.NVarChar(sql.MAX), JSON.stringify(answer));
        batch.input(`cj${i}`, sql.NVarChar(sql.MAX), JSON.stringify(ev.correctPayload));
        batch.input(`qt${i}`, sql.NVarChar(40), q.question_type || 'single_choice');
        batch.input(`rt${i}`, sql.Int, q.response_ms == null ? null : q.response_ms);

        sqlBatch += `
          INSERT INTO dbo.question_attempts
          (question_id,user_id,exam,selected_answer,correct_answer,selected_json,correct_json,
           question_type,is_correct,points_earned,points_max,study_mode,session_id,response_ms)
          VALUES
          (@qid${i},@uid,@exam,@sa${i},@ca${i},@sj${i},@cj${i},@qt${i},@isc${i},@pe${i},@pm${i},N'simulado',@session_id,@rt${i});
        `;
      }

      results.push({
        position: q.position,
        question_id: q.id,
        question_type: q.question_type || 'single_choice',
        answered: answer != null,
        selected: answer,
        correct_payload: ev.correctPayload,
        is_correct: ev.isCorrect,
        points_earned: ev.pointsEarned,
        points_max: ev.pointsMax,
        question: q.question,
        topic: q.topic,
        domain_code: q.domain_code,
        explanation: q.explanation,
        why_correct: q.why_correct,
        memory_rule: q.memory_rule,
        trap: q.trap,
      });
    });

    if (sqlBatch) await batch.query(sqlBatch);

    // Recalculate spaced-repetition status using the latest two attempts for every affected question.
    await new sql.Request(tx)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), session.exam)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .query(`
        ;WITH affected AS (
          SELECT DISTINCT question_id
          FROM dbo.question_attempts
          WHERE session_id=@session_id
        ), ranked AS (
          SELECT a.question_id, a.is_correct, a.answered_at,
                 ROW_NUMBER() OVER(PARTITION BY a.question_id ORDER BY a.answered_at DESC, a.attempt_id DESC) rn
          FROM dbo.question_attempts a
          INNER JOIN affected x ON x.question_id=a.question_id
          WHERE a.user_id=@uid AND a.exam=@exam
        ), last2 AS (
          SELECT question_id,
                 MAX(CASE WHEN rn=1 THEN CAST(is_correct AS INT) END) r1,
                 MAX(CASE WHEN rn=2 THEN CAST(is_correct AS INT) END) r2,
                 MAX(CASE WHEN rn=1 THEN answered_at END) t1,
                 MAX(CASE WHEN rn=2 THEN answered_at END) t2,
                 COUNT(CASE WHEN rn<=2 THEN 1 END) cnt
          FROM ranked WHERE rn<=2 GROUP BY question_id
        )
        UPDATE q
        SET status = CASE
          WHEN l.cnt>=2 AND l.r1=1 AND l.r2=1 AND DATEDIFF(HOUR,l.t2,l.t1)>=24 THEN N'acertei'
          WHEN l.cnt>=2 AND l.r1=0 AND l.r2=0 THEN N'errei'
          ELSE N'revisar'
        END,
        last_reviewed=GETDATE(), updated_at=GETDATE()
        FROM dbo.dp300_questions q
        INNER JOIN last2 l ON l.question_id=q.id
        WHERE q.user_id=@uid AND q.exam=@exam;
      `);

    const rawPct = totalMax ? Math.round((totalEarned / totalMax) * 10000) / 100 : 0;
    await new sql.Request(tx)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('earned', sql.Decimal(10,2), totalEarned)
      .input('max', sql.Decimal(10,2), totalMax)
      .input('pct', sql.Decimal(6,2), rawPct)
      .query(`
        UPDATE dbo.exam_sessions
        SET status=N'submitted', submitted_at=SYSUTCDATETIME(),
            points_earned=@earned, points_max=@max, raw_score_pct=@pct
        WHERE session_id=@session_id;
      `);

    await tx.commit();

    return res.status(200).json({
      ok: true,
      session_id: sessionId,
      points_earned: totalEarned,
      points_max: totalMax,
      raw_score_pct: rawPct,
      note: 'Percentual bruto do simulador; não equivale à pontuação escalonada oficial da Microsoft.',
      results,
    });
  } catch (e) {
    if (tx) { try { await tx.rollback(); } catch (_) {} }
    console.error('[exam/submit]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
