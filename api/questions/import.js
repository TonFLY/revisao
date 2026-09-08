const sql = require('mssql');

const config = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  connectionTimeout: 8000,

  // Dei mais tempo somente para importação.
  requestTimeout: 30000,

  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  }
};

function normalizeExam(value) {
  return ['DP-300', 'DP-800'].includes(value)
    ? value
    : 'DP-300';
}

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  if (!process.env.DB_HOST) {
    return res.status(500).json({
      error:
        'Variáveis de ambiente DB_* não configuradas na Vercel.'
    });
  }

  const uid = (req.query.uid || 'default')
    .trim()
    .toLowerCase()
    .slice(0, 50);

  const exam = normalizeExam(
    (req.query.exam || 'DP-300')
      .trim()
      .slice(0, 20)
  );

  const body = req.body || {};

  /*
    Aceita tanto:

    {
      "questions": [...]
    }

    quanto:

    [...]
  */
  const questions = Array.isArray(body)
    ? body
    : Array.isArray(body.questions)
      ? body.questions
      : [];

  if (!questions.length) {
    return res.status(400).json({
      error: 'Nenhuma questão encontrada para importação.'
    });
  }

  if (questions.length > 2000) {
    return res.status(400).json({
      error:
        'Máximo de 2000 questões por importação.'
    });
  }

  let pool;

  try {

    pool = await sql.connect(config);

    const result = await pool
      .request()

      .input(
        'user_id',
        sql.NVarChar(50),
        uid
      )

      .input(
        'exam',
        sql.NVarChar(20),
        exam
      )

      .input(
        'json',
        sql.NVarChar(sql.MAX),
        JSON.stringify(questions)
      )

      .execute(
        'dbo.ImportDpQuestions'
      );

    const info =
      result.recordset?.[0] || {};

    return res.status(201).json({
      ok: true,
      received: questions.length,
      inserted: info.inserted || 0,
      exam
    });

  } catch (e) {

    console.error(
      '[questions/import] error:',
      e
    );

    return res.status(500).json({
      error: e.message
    });

  } finally {

    if (pool) {
      await pool
        .close()
        .catch(() => {});
    }

  }
};