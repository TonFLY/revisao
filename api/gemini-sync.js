const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 8000,
  requestTimeout: 12000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  // O Google Doc atual é exclusivo do Wellington / DP-300.
  const uid = 'wellington';
  const exam = 'DP-300';

  let pool;

  try {
    pool = await sql.connect(config);

    const resumo = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'acertei' THEN 1 ELSE 0 END) AS acertei,
          SUM(CASE WHEN status = 'errei' THEN 1 ELSE 0 END) AS errei,
          SUM(CASE WHEN status = 'revisar' THEN 1 ELSE 0 END) AS revisar,
          SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendente
        FROM dbo.dp300_questions
        WHERE user_id = @uid
          AND exam = @exam;
      `);

    const historico = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        WITH ordered AS
        (
          SELECT
            attempt_id,
            question_id,
            is_correct,
            answered_at,
            LAG(answered_at) OVER
            (
              PARTITION BY question_id
              ORDER BY answered_at, attempt_id
            ) AS previous_answered_at
          FROM dbo.question_attempts
          WHERE user_id = @uid
            AND exam = @exam
        )
        SELECT
          COUNT(*) AS attempts,
          COUNT(DISTINCT question_id) AS distinct_questions,
          COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
          COALESCE(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong,
          CAST(
            CASE WHEN COUNT(*) = 0 THEN 0
                 ELSE 100.0 * SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*)
            END
            AS DECIMAL(5,2)
          ) AS accuracy_pct,

          COALESCE(SUM(
            CASE
              WHEN previous_answered_at IS NULL
                OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
              THEN 1 ELSE 0
            END
          ), 0) AS cold_attempts,

          COALESCE(SUM(
            CASE
              WHEN (
                previous_answered_at IS NULL
                OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
              )
              AND is_correct = 1
              THEN 1 ELSE 0
            END
          ), 0) AS cold_correct,

          COALESCE(SUM(
            CASE
              WHEN (
                previous_answered_at IS NULL
                OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
              )
              AND is_correct = 0
              THEN 1 ELSE 0
            END
          ), 0) AS cold_wrong,

          CAST(
            CASE
              WHEN SUM(
                CASE
                  WHEN previous_answered_at IS NULL
                    OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
                  THEN 1 ELSE 0
                END
              ) = 0 THEN 0
              ELSE
                100.0 *
                SUM(
                  CASE
                    WHEN (
                      previous_answered_at IS NULL
                      OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
                    )
                    AND is_correct = 1
                    THEN 1 ELSE 0
                  END
                )
                /
                SUM(
                  CASE
                    WHEN previous_answered_at IS NULL
                      OR DATEDIFF(HOUR, previous_answered_at, answered_at) >= 24
                    THEN 1 ELSE 0
                  END
                )
            END
            AS DECIMAL(5,2)
          ) AS cold_accuracy_pct
        FROM ordered;
      `);

    const topicos = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT TOP (12)
          q.topic,
          COUNT(*) AS attempts,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
          SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
          COUNT(DISTINCT a.question_id) AS distinct_questions,
          CAST(
            100.0 * SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0)
            AS DECIMAL(5,2)
          ) AS accuracy_pct
        FROM dbo.question_attempts a
        INNER JOIN dbo.dp300_questions q
          ON q.id = a.question_id
         AND q.user_id = a.user_id
         AND q.exam = a.exam
        WHERE a.user_id = @uid
          AND a.exam = @exam
        GROUP BY q.topic
        ORDER BY
          accuracy_pct ASC,
          wrong_count DESC,
          attempts DESC;
      `);

    const maisErradas = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT TOP (10)
          q.id AS question_id,
          q.topic,
          COUNT(*) AS attempts,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
          SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
          CAST(
            100.0 * SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0)
            AS DECIMAL(5,2)
          ) AS accuracy_pct
        FROM dbo.question_attempts a
        INNER JOIN dbo.dp300_questions q
          ON q.id = a.question_id
         AND q.user_id = a.user_id
         AND q.exam = a.exam
        WHERE a.user_id = @uid
          AND a.exam = @exam
        GROUP BY q.id, q.topic
        HAVING SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) > 0
        ORDER BY
          wrong_count DESC,
          attempts DESC,
          accuracy_pct ASC;
      `);

    const ultimoSimulado = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT TOP (1)
          session_id, question_count, duration_minutes, started_at, submitted_at,
          points_earned, points_max, raw_score_pct
        FROM dbo.exam_sessions
        WHERE user_id=@uid AND exam=@exam AND status=N'submitted'
        ORDER BY submitted_at DESC;
      `);

    const dominios = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT
          COALESCE(q.domain_code, N'legacy') AS domain_code,
          COUNT(*) AS attempts,
          SUM(CASE WHEN a.is_correct=1 THEN 1 ELSE 0 END) AS correct_count,
          SUM(CASE WHEN a.is_correct=0 THEN 1 ELSE 0 END) AS wrong_count,
          CAST(100.0*SUM(CASE WHEN a.is_correct=1 THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0) AS DECIMAL(5,2)) AS accuracy_pct
        FROM dbo.question_attempts a
        INNER JOIN dbo.dp300_questions q
          ON q.id=a.question_id AND q.user_id=a.user_id AND q.exam=a.exam
        WHERE a.user_id=@uid AND a.exam=@exam
        GROUP BY COALESCE(q.domain_code, N'legacy')
        ORDER BY accuracy_pct ASC;
      `);

    const r = resumo.recordset[0] || {};
    const h = historico.recordset[0] || {};
    const lastExam = ultimoSimulado.recordset[0] || null;

    const payload = {
      user_id: uid,
      exam,

      total: r.total || 0,
      acertei: r.acertei || 0,
      errei: r.errei || 0,
      revisar: r.revisar || 0,
      pendente: r.pendente || 0,

      historico: {
        attempts: h.attempts || 0,
        distinct_questions: h.distinct_questions || 0,
        correct: h.correct || 0,
        wrong: h.wrong || 0,
        accuracy_pct: Number(h.accuracy_pct || 0)
      },

      frio: {
        attempts: h.cold_attempts || 0,
        correct: h.cold_correct || 0,
        wrong: h.cold_wrong || 0,
        accuracy_pct: Number(h.cold_accuracy_pct || 0)
      },

      topicos: topicos.recordset.map(t => ({
        topic: t.topic,
        attempts: t.attempts,
        distinct_questions: t.distinct_questions,
        correct: t.correct_count,
        wrong: t.wrong_count,
        accuracy_pct: Number(t.accuracy_pct || 0)
      })),

      questoes_mais_erradas: maisErradas.recordset.map(q => ({
        question_id: q.question_id,
        topic: q.topic,
        attempts: q.attempts,
        correct: q.correct_count,
        wrong: q.wrong_count,
        accuracy_pct: Number(q.accuracy_pct || 0)
      })),

      desempenho_por_dominio: dominios.recordset.map(d => ({
        domain_code: d.domain_code,
        attempts: d.attempts,
        correct: d.correct_count,
        wrong: d.wrong_count,
        accuracy_pct: Number(d.accuracy_pct || 0)
      })),

      ultimo_simulado: lastExam ? {
        session_id: lastExam.session_id,
        question_count: lastExam.question_count,
        duration_minutes: lastExam.duration_minutes,
        submitted_at: lastExam.submitted_at,
        points_earned: Number(lastExam.points_earned || 0),
        points_max: Number(lastExam.points_max || 0),
        raw_score_pct: Number(lastExam.raw_score_pct || 0)
      } : null
    };

    const googleResponse = await fetch(process.env.GEMINI_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const googleText = await googleResponse.text();

    if (!googleResponse.ok) {
      throw new Error(`Google Sync HTTP ${googleResponse.status}: ${googleText}`);
    }

    return res.status(200).json({
      ok: true,
      sync: {
        user_id: uid,
        exam,
        attempts: payload.historico.attempts,
        accuracy_pct: payload.historico.accuracy_pct,
        cold_accuracy_pct: payload.frio.accuracy_pct
      },
      google: googleText
    });

  } catch (e) {
    console.error('[gemini-sync]', e);

    return res.status(500).json({
      ok: false,
      error: e.message
    });

  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
};
