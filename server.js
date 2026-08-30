const express = require('express');
const sql     = require('mssql');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const config = {
  server  : '191.101.71.175',
  port    : 1433,
  database: 'NossaRotina',
  user    : 'sa',
  password: 'Aa##91684895',
  options : { encrypt: false, trustServerCertificate: true }
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}

// listar
app.get('/api/questions', async (req, res) => {
  try {
    const db = await getPool();
    const r  = await db.request().query('SELECT * FROM dp300_questions ORDER BY created_at DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// criar
app.post('/api/questions', async (req, res) => {
  const { question, option_a, option_b, option_c, option_d, correct, explanation, topic, difficulty } = req.body;
  try {
    const db = await getPool();
    const r  = await db.request()
      .input('question',    sql.NVarChar, question)
      .input('option_a',    sql.NVarChar, option_a)
      .input('option_b',    sql.NVarChar, option_b)
      .input('option_c',    sql.NVarChar, option_c)
      .input('option_d',    sql.NVarChar, option_d)
      .input('correct',     sql.Char,     correct.toUpperCase())
      .input('explanation', sql.NVarChar, explanation || '')
      .input('topic',       sql.NVarChar, topic)
      .input('difficulty',  sql.NVarChar, difficulty || 'medio')
      .query(`INSERT INTO dp300_questions
                (question,option_a,option_b,option_c,option_d,correct,explanation,topic,difficulty)
              OUTPUT INSERTED.*
              VALUES (@question,@option_a,@option_b,@option_c,@option_d,@correct,@explanation,@topic,@difficulty)`);
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// atualizar
app.put('/api/questions/:id', async (req, res) => {
  const { question, option_a, option_b, option_c, option_d, correct, explanation, topic, difficulty, status } = req.body;
  try {
    const db = await getPool();
    const r  = await db.request()
      .input('id',          sql.Int,      req.params.id)
      .input('question',    sql.NVarChar, question)
      .input('option_a',    sql.NVarChar, option_a)
      .input('option_b',    sql.NVarChar, option_b)
      .input('option_c',    sql.NVarChar, option_c)
      .input('option_d',    sql.NVarChar, option_d)
      .input('correct',     sql.Char,     correct.toUpperCase())
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
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// excluir
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const db = await getPool();
    await db.request().input('id', sql.Int, req.params.id).query('DELETE FROM dp300_questions WHERE id=@id');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3001, () => console.log('Rodando em http://localhost:3001'));
