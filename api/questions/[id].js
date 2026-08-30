import sql from 'mssql';

const config = {
  server  : process.env.DB_HOST,
  port    : parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user    : process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options : { encrypt: false, trustServerCertificate: true }
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = parseInt(req.query.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  try {
    const db = await getPool();

    // PUT /api/questions/:id
    if (req.method === 'PUT') {
      const { question, option_a, option_b, option_c, option_d, correct, explanation, topic, difficulty, status } = req.body;
      const r = await db.request()
        .input('id',          sql.Int,      id)
        .input('question',    sql.NVarChar, question)
        .input('option_a',    sql.NVarChar, option_a)
        .input('option_b',    sql.NVarChar, option_b)
        .input('option_c',    sql.NVarChar, option_c)
        .input('option_d',    sql.NVarChar, option_d)
        .input('correct',     sql.Char,     (correct || 'A').toUpperCase())
        .input('explanation', sql.NVarChar, explanation || '')
        .input('topic',       sql.NVarChar, topic)
        .input('difficulty',  sql.NVarChar, difficulty)
        .input('status',      sql.NVarChar, status)
        .query(`UPDATE dp300_questions
                SET question=@question, option_a=@option_a, option_b=@option_b,
                    option_c=@option_c, option_d=@option_d, correct=@correct,
                    explanation=@explanation, topic=@topic, difficulty=@difficulty,
                    status=@status, updated_at=GETDATE(), last_reviewed=GETDATE()
                OUTPUT INSERTED.*
                WHERE id=@id`);
      return res.status(200).json(r.recordset[0]);
    }

    // DELETE /api/questions/:id
    if (req.method === 'DELETE') {
      await db.request().input('id', sql.Int, id).query('DELETE FROM dp300_questions WHERE id=@id');
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
