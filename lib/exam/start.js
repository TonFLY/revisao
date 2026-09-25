const crypto = require('crypto');
const { sql, openPool, cleanUid, cleanExam } = require('../db');

const DOMAIN_WEIGHTS = [
  ['platform', 0.18],
  ['security', 0.22],
  ['performance', 0.22],
  ['automation', 0.16],
  ['hadr', 0.22],
];

function quotas(total) {
  const out = {};
  let used = 0;
  DOMAIN_WEIGHTS.forEach(([d, w], i) => {
    const n = i === DOMAIN_WEIGHTS.length - 1 ? total - used : Math.round(total * w);
    out[d] = Math.max(0, n);
    used += out[d];
  });
  while (used > total) {
    const key = DOMAIN_WEIGHTS.slice().reverse().find(([d]) => out[d] > 0)?.[0];
    if (!key) break;
    out[key]--; used--;
  }
  while (used < total) { out.hadr++; used++; }
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupCases(rows) {
  const groups = [];
  const byCase = new Map();
  rows.forEach(r => {
    if (r.case_id) {
      if (!byCase.has(r.case_id)) {
        const g = [];
        byCase.set(r.case_id, g);
        groups.push(g);
      }
      byCase.get(r.case_id).push(r);
    } else {
      groups.push([r]);
    }
  });
  return shuffle(groups).flat();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const b = req.body || {};
  const uid = cleanUid(b.uid || req.query.uid);
  const exam = cleanExam(b.exam || req.query.exam);
  const requestedCount = Math.min(60, Math.max(5, parseInt(b.question_count || 50, 10)));
  const duration = Math.min(180, Math.max(10, parseInt(b.duration_minutes || 100, 10)));
  const q = quotas(requestedCount);

  let pool;
  let tx;
  try {
    pool = await openPool();
    const picked = [];

    for (const [domain] of DOMAIN_WEIGHTS) {
      const n = q[domain];
      if (!n) continue;
      const r = await pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), exam)
        .input('domain', sql.NVarChar(40), domain)
        .input('n', sql.Int, n)
        .query(`
          WITH perf AS (
            SELECT question_id, MAX(answered_at) last_attempt
            FROM dbo.question_attempts
            WHERE user_id=@uid AND exam=@exam
            GROUP BY question_id
          )
          SELECT TOP (@n) q.id, q.case_id, q.domain_code
          FROM dbo.dp300_questions q
          LEFT JOIN perf p ON p.question_id=q.id
          WHERE q.user_id=@uid AND q.exam=@exam
            AND q.origin=N'real' AND q.domain_code=@domain
          ORDER BY CASE WHEN p.last_attempt IS NULL THEN 0 ELSE 1 END,
                   p.last_attempt ASC,
                   q.realism_level DESC,
                   NEWID();
        `);
      picked.push(...r.recordset);
    }

    const unique = new Map(picked.map(x => [x.id, x]));
    let selected = [...unique.values()];

    if (selected.length < requestedCount) {
      const missing = requestedCount - selected.length;
      const exclude = selected.map(x => x.id);
      const req = pool.request()
        .input('uid', sql.NVarChar(100), uid)
        .input('exam', sql.NVarChar(40), exam)
        .input('n', sql.Int, missing);
      let whereExclude = '';
      if (exclude.length) {
        const ps = exclude.map((id, i) => {
          req.input(`x${i}`, sql.Int, id);
          return `@x${i}`;
        });
        whereExclude = `AND q.id NOT IN (${ps.join(',')})`;
      }
      const r = await req.query(`
        WITH perf AS (
          SELECT question_id, MAX(answered_at) last_attempt
          FROM dbo.question_attempts
          WHERE user_id=@uid AND exam=@exam
          GROUP BY question_id
        )
        SELECT TOP (@n) q.id, q.case_id, q.domain_code
        FROM dbo.dp300_questions q
        LEFT JOIN perf p ON p.question_id=q.id
        WHERE q.user_id=@uid AND q.exam=@exam AND q.origin=N'real'
          ${whereExclude}
        ORDER BY CASE WHEN p.last_attempt IS NULL THEN 0 ELSE 1 END,
                 p.last_attempt ASC,
                 q.realism_level DESC,
                 NEWID();
      `);
      selected.push(...r.recordset);
    }

    selected = groupCases(selected.slice(0, requestedCount));
    if (!selected.length) {
      return res.status(409).json({
        error: 'Nenhuma questão REAL disponível. Importe um banco com origin="real" antes de iniciar o simulado.'
      });
    }

    const sessionId = crypto.randomUUID();
    tx = new sql.Transaction(pool);
    await tx.begin();

    await new sql.Request(tx)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('uid', sql.NVarChar(100), uid)
      .input('exam', sql.NVarChar(40), exam)
      .input('count', sql.Int, selected.length)
      .input('duration', sql.Int, duration)
      .query(`
        INSERT INTO dbo.exam_sessions(session_id,user_id,exam,question_count,duration_minutes)
        VALUES(@session_id,@uid,@exam,@count,@duration);
      `);

    for (let i = 0; i < selected.length; i++) {
      await new sql.Request(tx)
        .input('session_id', sql.UniqueIdentifier, sessionId)
        .input('position', sql.Int, i + 1)
        .input('question_id', sql.Int, selected[i].id)
        .query(`
          INSERT INTO dbo.exam_session_questions(session_id,position,question_id)
          VALUES(@session_id,@position,@question_id);
        `);
    }

    await tx.commit();

    return res.status(201).json({
      ok: true,
      session_id: sessionId,
      exam,
      question_count: selected.length,
      requested_count: requestedCount,
      duration_minutes: duration,
      blueprint: q,
    });
  } catch (e) {
    if (tx) { try { await tx.rollback(); } catch (_) {} }
    console.error('[exam/start]', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
};
