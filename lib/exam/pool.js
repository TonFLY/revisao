const { sql, openPool, cleanUid, cleanExam } = require('../db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });
  const uid = cleanUid(req.query.uid);
  const exam = cleanExam(req.query.exam);
  let pool;
  try {
    pool = await openPool();
    const r = await pool.request()
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .query(`
        SELECT COUNT(*) total,
          SUM(CASE WHEN domain_code=N'platform' THEN 1 ELSE 0 END) platform,
          SUM(CASE WHEN domain_code=N'security' THEN 1 ELSE 0 END) security,
          SUM(CASE WHEN domain_code=N'performance' THEN 1 ELSE 0 END) performance,
          SUM(CASE WHEN domain_code=N'automation' THEN 1 ELSE 0 END) automation,
          SUM(CASE WHEN domain_code=N'hadr' THEN 1 ELSE 0 END) hadr
        FROM dbo.dp300_questions
        WHERE user_id=@uid AND exam=@exam AND origin=N'real';
      `);
    return res.status(200).json(r.recordset[0] || { total:0 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(()=>{});
  }
};
