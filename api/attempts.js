const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 8000,
  requestTimeout: 8000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Use POST'
    });
  }

  const uid = (req.query.uid || 'default')
    .trim()
    .toLowerCase()
    .slice(0, 100);

  const exam = (req.query.exam || 'DP-300')
    .trim()
    .slice(0, 40);

  const {
    question_id,
    selected_answer,
    study_mode,
    response_ms
  } = req.body || {};

  const questionId = parseInt(question_id);

  const selected = String(selected_answer || '')
    .trim()
    .toUpperCase();

  if (!questionId) {
    return res.status(400).json({
      error: 'question_id inválido'
    });
  }

  if (!['A', 'B', 'C', 'D'].includes(selected)) {
    return res.status(400).json({
      error: 'selected_answer deve ser A, B, C ou D'
    });
  }

  let pool;
  let transaction;

  try {
    pool = await sql.connect(config);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    /*
      Busca o gabarito no servidor.

      O navegador manda apenas:
      - questão
      - alternativa escolhida

      O servidor decide se acertou.
    */
    const qResult = await new sql.Request(transaction)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT
          id,
          correct,
          status
        FROM dbo.dp300_questions
        WHERE id = @question_id
          AND user_id = @uid
          AND exam = @exam
      `);

    if (!qResult.recordset.length) {
      await transaction.rollback();

      return res.status(404).json({
        error: 'Questão não encontrada para esse usuário/exame'
      });
    }

    const question = qResult.recordset[0];

    const correctAnswer = String(question.correct)
      .trim()
      .toUpperCase();

    const isCorrect = selected === correctAnswer;

    /*
      Registra TODA tentativa.
    */
    await new sql.Request(transaction)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .input('selected_answer', sql.Char(1), selected)
      .input('correct_answer', sql.Char(1), correctAnswer)
      .input('is_correct', sql.Bit, isCorrect)
      .input(
        'study_mode',
        sql.NVarChar(30),
        study_mode ? String(study_mode).slice(0, 30) : null
      )
      .input(
        'response_ms',
        sql.Int,
        Number.isFinite(Number(response_ms))
          ? Math.max(0, Math.floor(Number(response_ms)))
          : null
      )
      .query(`
        INSERT INTO dbo.question_attempts
        (
          question_id,
          user_id,
          exam,
          selected_answer,
          correct_answer,
          is_correct,
          study_mode,
          response_ms
        )
        VALUES
        (
          @question_id,
          @uid,
          @exam,
          @selected_answer,
          @correct_answer,
          @is_correct,
          @study_mode,
          @response_ms
        )
      `);

    /*
      Pega as duas tentativas mais recentes.
    */
    const recentResult = await new sql.Request(transaction)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT TOP (2)
          is_correct,
          answered_at
        FROM dbo.question_attempts
        WHERE question_id = @question_id
          AND user_id = @uid
          AND exam = @exam
        ORDER BY answered_at DESC, attempt_id DESC
      `);

    const recent = recentResult.recordset;

    let newStatus = 'revisar';

    /*
      REGRA ANTI-MEMORIZAÇÃO

      Para "acertei":
      - últimas duas precisam estar corretas
      - precisam ter >= 24h entre elas

      Repetir a questão imediatamente não promove.
    */
    if (
      recent.length >= 2 &&
      recent[0].is_correct &&
      recent[1].is_correct
    ) {
      const newest = new Date(recent[0].answered_at);
      const older = new Date(recent[1].answered_at);

      const diffMs = newest.getTime() - older.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= 24) {
        newStatus = 'acertei';
      } else {
        newStatus = 'revisar';
      }
    }

    /*
      Dois erros consecutivos = errei
    */
    if (
      recent.length >= 2 &&
      !recent[0].is_correct &&
      !recent[1].is_correct
    ) {
      newStatus = 'errei';
    }

    /*
      Atualiza o status atual da questão.
    */
    await new sql.Request(transaction)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .input('status', sql.NVarChar(40), newStatus)
      .query(`
        UPDATE dbo.dp300_questions
        SET
          status = @status,
          last_reviewed = GETDATE(),
          updated_at = GETDATE()
        WHERE id = @question_id
          AND user_id = @uid
          AND exam = @exam
      `);

    /*
      Estatísticas históricas da questão.
    */
    const statsResult = await new sql.Request(transaction)
      .input('question_id', sql.Int, questionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT
          COUNT(*) AS attempt_count,

          SUM(
            CASE WHEN is_correct = 1
            THEN 1 ELSE 0 END
          ) AS correct_count,

          SUM(
            CASE WHEN is_correct = 0
            THEN 1 ELSE 0 END
          ) AS wrong_count,

          CAST(
            100.0 *
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0)
            AS DECIMAL(5,2)
          ) AS historical_accuracy_pct

        FROM dbo.question_attempts

        WHERE question_id = @question_id
          AND user_id = @uid
          AND exam = @exam
      `);

    await transaction.commit();

    const stats = statsResult.recordset[0];

    return res.status(200).json({
      ok: true,

      question_id: questionId,

      selected_answer: selected,
      correct_answer: correctAnswer,

      is_correct: isCorrect,

      status: newStatus,

      history: {
        attempts: stats.attempt_count || 0,
        correct: stats.correct_count || 0,
        wrong: stats.wrong_count || 0,
        accuracy_pct: Number(
          stats.historical_accuracy_pct || 0
        )
      }
    });

  } catch (e) {

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }

    console.error('[attempts]', e);

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