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
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Use POST'
    });
  }

  const uid = 'wellington';
  const exam = 'DP-300';

  let pool;

  try {
    pool = await sql.connect(config);

    // Resumo geral
    const resumo = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .input('exam', sql.NVarChar, exam)
      .query(`
        SELECT
          COUNT(*) AS total,

          SUM(CASE
            WHEN status = 'acertei' THEN 1
            ELSE 0
          END) AS acertei,

          SUM(CASE
            WHEN status = 'errei' THEN 1
            ELSE 0
          END) AS errei,

          SUM(CASE
            WHEN status = 'revisar' THEN 1
            ELSE 0
          END) AS revisar,

          SUM(CASE
            WHEN status = 'pendente' THEN 1
            ELSE 0
          END) AS pendente

        FROM dp300_questions
        WHERE
          user_id = @uid
          AND exam = @exam
      `);

    // Tópicos mais fracos
    const fracos = await pool.request()
      .input('uid', sql.NVarChar, uid)
      .input('exam', sql.NVarChar, exam)
      .query(`
        SELECT TOP (8)
          topic,
          SUM(CASE WHEN status = 'errei' THEN 1 ELSE 0 END) AS errei,
          SUM(CASE WHEN status = 'revisar' THEN 1 ELSE 0 END) AS revisar,
          SUM(
            CASE
              WHEN status = 'errei' THEN 2
              WHEN status = 'revisar' THEN 1
              ELSE 0
            END
          ) AS pontos

        FROM dp300_questions

        WHERE
          user_id = @uid
          AND exam = @exam

        GROUP BY topic

        HAVING
          SUM(
            CASE
              WHEN status IN ('errei', 'revisar') THEN 1
              ELSE 0
            END
          ) > 0

        ORDER BY
          pontos DESC,
          errei DESC,
          revisar DESC
      `);

    const r = resumo.recordset[0];

    const payload = {
      user_id: uid,
      exam,

      total: r.total || 0,
      acertei: r.acertei || 0,
      errei: r.errei || 0,
      revisar: r.revisar || 0,
      pendente: r.pendente || 0,

      topicos_fracos: fracos.recordset.map(t =>
        `${t.topic} — ${t.errei} errei / ${t.revisar} revisar`
      )
    };

    // Envia para o Google Doc
    const googleResponse = await fetch(
      process.env.GEMINI_SYNC_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const googleText = await googleResponse.text();

    return res.status(200).json({
      ok: true,
      enviado: payload,
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