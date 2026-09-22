const sql = require('mssql');

const REQUIRED_SCOPE = 'study:read';

function normalizeExam(value) {
  const v = String(value || 'DP-300').trim().toUpperCase();
  return /^DP-\d{3}$/.test(v) ? v : null;
}

function normalizeDay(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

function normalizeDifficulty(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return ['facil', 'medio', 'dificil'].includes(v) ? v : null;
}

function normalizeStatus(value) {
  if (!value || String(value).toLowerCase() === 'any') return null;
  const v = String(value).trim().toLowerCase();
  return ['pendente', 'acertei', 'revisar', 'errei'].includes(v) ? v : null;
}

function getDbConfig() {
  return {
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: 10000,
    requestTimeout: 15000,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
      enableArithAbort: true,
    },
  };
}

function assertEnv() {
  const required = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'AUTH0_DOMAIN',
    'AUTH0_AUDIENCE',
    'MCP_SERVER_URL',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);
  }
}

function protectedResourceUrl() {
  const serverUrl = String(process.env.MCP_SERVER_URL || '').replace(/\/+$/, '');
  return serverUrl.replace(/\/api\/mcp$/, '/api/oauth-protected-resource');
}

function authChallenge(error, description) {
  return `Bearer resource_metadata="${protectedResourceUrl()}", scope="${REQUIRED_SCOPE}", error="${error}", error_description="${String(description || '').replace(/"/g, "'")}"`;
}

async function verifyAccessToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error('Token OAuth ausente.');
    err.statusCode = 401;
    err.challenge = authChallenge('invalid_token', 'OAuth login is required');
    throw err;
  }

  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const issuer = `https://${process.env.AUTH0_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));

  let verified;
  try {
    verified = await jwtVerify(match[1], jwks, {
      issuer,
      audience: process.env.AUTH0_AUDIENCE,
    });
  } catch (e) {
    const err = new Error('Token OAuth inválido ou expirado.');
    err.statusCode = 401;
    err.challenge = authChallenge('invalid_token', 'The access token is invalid or expired');
    throw err;
  }

  const payload = verified.payload;

  const scopes = new Set(String(payload.scope || '').split(/\s+/).filter(Boolean));
  if (!scopes.has(REQUIRED_SCOPE)) {
    const err = new Error(`Escopo obrigatório ausente: ${REQUIRED_SCOPE}`);
    err.statusCode = 403;
    err.challenge = authChallenge('insufficient_scope', `Scope ${REQUIRED_SCOPE} is required`);
    throw err;
  }

  return payload;
}

async function withDb(fn) {
  const pool = new sql.ConnectionPool(getDbConfig());
  await pool.connect();
  try {
    return await fn(pool);
  } finally {
    await pool.close().catch(() => {});
  }
}

async function resolveMappedUser(authSub) {
  return withDb(async (pool) => {
    const r = await pool.request()
      .input('authSub', sql.NVarChar(255), String(authSub || ''))
      .query(`
        SELECT TOP 1
          user_id,
          display_name
        FROM dbo.mcp_user_map
        WHERE auth_sub = @authSub
          AND is_active = 1
      `);

    const row = r.recordset[0];
    if (!row) {
      const err = new Error(
        'Sua conta OAuth ainda não está vinculada a um usuário da aplicação Revisão.'
      );
      err.statusCode = 403;
      throw err;
    }

    return {
      user_id: row.user_id,
      display_name: row.display_name || null,
    };
  });
}

function daySql(day, alias = '') {
  if (!day) return { clause: '', prefix: null };
  const col = alias ? `${alias}.topic` : 'topic';
  return {
    clause: ` AND UPPER(${col}) LIKE @dayPrefix`,
    prefix: `DIA ${day}%`,
  };
}

function noDecorebaSql(includeDecoreba, alias = '') {
  if (includeDecoreba) return '';
  const col = alias ? `${alias}.topic` : 'topic';
  return ` AND LOWER(${col}) NOT LIKE 'decoreba%'`;
}

function publicQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    exam: row.exam,
    question: row.question,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    topic: row.topic,
    difficulty: row.difficulty,
    status: row.status,
    last_reviewed: row.last_reviewed || null,
  };
}

function toolResult(obj, text) {
  return {
    content: [{ type: 'text', text: text || JSON.stringify(obj, null, 2) }],
    structuredContent: obj,
  };
}

async function createServer(mappedUser) {
  const [{ McpServer }, { z }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('zod'),
  ]);

  const server = new McpServer(
    { name: 'revisao-certificacoes', version: '1.0.0' },
    {
      instructions:
        'Tutor de certificações. Nunca revele o gabarito antes de o aluno registrar uma alternativa. ' +
        'Para apresentar uma questão, use get_next_question ou get_question. ' +
        'Somente depois de o aluno responder A/B/C/D use check_answer. ' +
        'get_weak_topics usa um indicador heurístico baseado no status atual, não uma taxa histórica de acertos.',
    }
  );

  const readAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const securitySchemes = [{ type: 'oauth2', scopes: [REQUIRED_SCOPE] }];

  server.registerTool(
    'get_profile',
    {
      title: 'Perfil do estudo',
      description: 'Retorna o usuário de estudo vinculado a esta conexão MCP. Não retorna gabaritos.',
      inputSchema: z.object({}),
      annotations: readAnnotations,
      securitySchemes,
    },
    async () =>
      toolResult({
        user_id: mappedUser.user_id,
        display_name: mappedUser.display_name,
        mode: 'read-only',
        note: 'O usuário foi resolvido pelo sub OAuth. As ferramentas MCP não alteram o banco nesta versão.',
      })
  );

  server.registerTool(
    'get_progress',
    {
      title: 'Progresso do exame',
      description:
        'Resume os status das questões de um exame e, opcionalmente, de um dia de estudo. ' +
        'Não trate esses status como histórico bruto de tentativas.',
      inputSchema: z.object({
        exam: z.string().default('DP-300').describe('Código no formato DP-XXX.'),
        day: z.number().int().min(1).max(99).optional().describe('Dia de estudo, por exemplo 1.'),
        include_decoreba: z.boolean().default(false),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ exam, day, include_decoreba }) => {
      const normalizedExam = normalizeExam(exam);
      const normalizedDay = normalizeDay(day);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');

      const d = daySql(normalizedDay);
      const rows = await withDb(async (pool) => {
        const req = pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam);
        if (d.prefix) req.input('dayPrefix', sql.NVarChar(100), d.prefix);

        const r = await req.query(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) AS pendente,
            SUM(CASE WHEN status='acertei'  THEN 1 ELSE 0 END) AS acertei,
            SUM(CASE WHEN status='revisar'  THEN 1 ELSE 0 END) AS revisar,
            SUM(CASE WHEN status='errei'    THEN 1 ELSE 0 END) AS errei
          FROM dbo.dp300_questions
          WHERE user_id=@uid AND exam=@exam
          ${d.clause}
          ${noDecorebaSql(include_decoreba)}
        `);
        return r.recordset[0];
      });

      const result = {
        exam: normalizedExam,
        day: normalizedDay,
        total: Number(rows.total || 0),
        pendente: Number(rows.pendente || 0),
        acertei: Number(rows.acertei || 0),
        revisar: Number(rows.revisar || 0),
        errei: Number(rows.errei || 0),
      };
      return toolResult(result);
    }
  );

  server.registerTool(
    'get_weak_topics',
    {
      title: 'Tópicos prioritários para revisão',
      description:
        'Lista tópicos com maior prioridade de revisão usando os status atuais. ' +
        'A métrica é heurística: errei pesa mais que revisar; pendentes não entram no cálculo.',
      inputSchema: z.object({
        exam: z.string().default('DP-300'),
        day: z.number().int().min(1).max(99).optional(),
        limit: z.number().int().min(1).max(20).default(5),
        include_decoreba: z.boolean().default(false),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ exam, day, limit, include_decoreba }) => {
      const normalizedExam = normalizeExam(exam);
      const normalizedDay = normalizeDay(day);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');

      const d = daySql(normalizedDay);
      const result = await withDb(async (pool) => {
        const req = pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam)
          .input('limit', sql.Int, Number(limit));
        if (d.prefix) req.input('dayPrefix', sql.NVarChar(100), d.prefix);

        const r = await req.query(`
          SELECT TOP (@limit)
            topic,
            SUM(CASE WHEN status IN ('acertei','revisar','errei') THEN 1 ELSE 0 END) AS respondidas,
            SUM(CASE WHEN status='acertei' THEN 1 ELSE 0 END) AS acertei,
            SUM(CASE WHEN status='revisar' THEN 1 ELSE 0 END) AS revisar,
            SUM(CASE WHEN status='errei' THEN 1 ELSE 0 END) AS errei,
            CAST(
              (
                SUM(CASE WHEN status='errei' THEN 3.0 WHEN status='revisar' THEN 1.0 ELSE 0 END)
                / NULLIF(SUM(CASE WHEN status IN ('acertei','revisar','errei') THEN 1.0 ELSE 0 END), 0)
              ) AS DECIMAL(10,3)
            ) AS prioridade
          FROM dbo.dp300_questions
          WHERE user_id=@uid AND exam=@exam
          ${d.clause}
          ${noDecorebaSql(include_decoreba)}
          GROUP BY topic
          HAVING SUM(CASE WHEN status IN ('acertei','revisar','errei') THEN 1 ELSE 0 END) > 0
          ORDER BY prioridade DESC, errei DESC, revisar DESC, topic ASC
        `);
        return r.recordset;
      });

      return toolResult({
        exam: normalizedExam,
        day: normalizedDay,
        metric: 'prioridade = (3*errei + 1*revisar) / respondidas',
        topics: result.map((x) => ({
          topic: x.topic,
          respondidas: Number(x.respondidas || 0),
          acertei: Number(x.acertei || 0),
          revisar: Number(x.revisar || 0),
          errei: Number(x.errei || 0),
          prioridade: Number(x.prioridade || 0),
        })),
      });
    }
  );

  server.registerTool(
    'get_next_question',
    {
      title: 'Buscar próxima questão',
      description:
        'Retorna UMA questão sem gabarito e sem explicações. Use para aplicar questões ao aluno. ' +
        'Nunca use check_answer antes de o aluno responder.',
      inputSchema: z.object({
        exam: z.string().default('DP-300'),
        day: z.number().int().min(1).max(99).optional(),
        status: z.enum(['any', 'pendente', 'acertei', 'revisar', 'errei']).default('pendente'),
        difficulty: z.enum(['facil', 'medio', 'dificil']).optional(),
        topic_contains: z.string().max(100).optional(),
        include_decoreba: z.boolean().default(false),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ exam, day, status, difficulty, topic_contains, include_decoreba }) => {
      const normalizedExam = normalizeExam(exam);
      const normalizedDay = normalizeDay(day);
      const normalizedStatus = normalizeStatus(status);
      const normalizedDifficulty = normalizeDifficulty(difficulty);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');

      const d = daySql(normalizedDay, 'q');
      const row = await withDb(async (pool) => {
        const req = pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam);
        if (d.prefix) req.input('dayPrefix', sql.NVarChar(100), d.prefix);
        if (normalizedStatus) req.input('status', sql.NVarChar(20), normalizedStatus);
        if (normalizedDifficulty) req.input('difficulty', sql.NVarChar(20), normalizedDifficulty);
        if (topic_contains) req.input('topicContains', sql.NVarChar(100), `%${String(topic_contains).slice(0, 96)}%`);

        const r = await req.query(`
          SELECT TOP 1
            q.id,q.exam,q.question,q.option_a,q.option_b,q.option_c,q.option_d,
            q.topic,q.difficulty,q.status,q.last_reviewed
          FROM dbo.dp300_questions q
          WHERE q.user_id=@uid AND q.exam=@exam
          ${d.clause}
          ${normalizedStatus ? ' AND q.status=@status' : ''}
          ${normalizedDifficulty ? ' AND q.difficulty=@difficulty' : ''}
          ${topic_contains ? ' AND q.topic LIKE @topicContains' : ''}
          ${noDecorebaSql(include_decoreba, 'q')}
          ORDER BY NEWID()
        `);
        return r.recordset[0] || null;
      });

      if (!row) return toolResult({ found: false, question: null }, 'Nenhuma questão encontrada com esses filtros.');
      return toolResult({ found: true, question: publicQuestion(row) });
    }
  );

  server.registerTool(
    'get_question',
    {
      title: 'Buscar questão por ID',
      description: 'Retorna a questão e alternativas sem gabarito nem explicações.',
      inputSchema: z.object({
        question_id: z.number().int().positive(),
        exam: z.string().default('DP-300'),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ question_id, exam }) => {
      const normalizedExam = normalizeExam(exam);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');

      const row = await withDb(async (pool) => {
        const r = await pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam)
          .input('id', sql.Int, Number(question_id))
          .query(`
            SELECT TOP 1
              id,exam,question,option_a,option_b,option_c,option_d,
              topic,difficulty,status,last_reviewed
            FROM dbo.dp300_questions
            WHERE user_id=@uid AND exam=@exam AND id=@id
          `);
        return r.recordset[0] || null;
      });

      if (!row) return toolResult({ found: false, question: null }, 'Questão não encontrada.');
      return toolResult({ found: true, question: publicQuestion(row) });
    }
  );

  server.registerTool(
    'check_answer',
    {
      title: 'Corrigir resposta',
      description:
        'Corrige uma alternativa A/B/C/D e retorna a explicação. ' +
        'Use SOMENTE depois que o aluno tiver informado explicitamente a alternativa escolhida.',
      inputSchema: z.object({
        question_id: z.number().int().positive(),
        answer: z.enum(['A', 'B', 'C', 'D']),
        exam: z.string().default('DP-300'),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ question_id, answer, exam }) => {
      const normalizedExam = normalizeExam(exam);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');

      const row = await withDb(async (pool) => {
        const r = await pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam)
          .input('id', sql.Int, Number(question_id))
          .query(`
            SELECT TOP 1
              id,exam,question,option_a,option_b,option_c,option_d,correct,
              explanation,why_correct,why_a_wrong,why_b_wrong,why_c_wrong,why_d_wrong,
              exam_keyword,memory_rule,trap,source_name,source_url,verified,
              topic,difficulty,status,last_reviewed
            FROM dbo.dp300_questions
            WHERE user_id=@uid AND exam=@exam AND id=@id
          `);
        return r.recordset[0] || null;
      });

      if (!row) return toolResult({ found: false }, 'Questão não encontrada.');

      const selected = String(answer).toUpperCase();
      const correct = String(row.correct || '').toUpperCase();
      const result = {
        found: true,
        question_id: row.id,
        answer: selected,
        is_correct: selected === correct,
        correct,
        explanation: row.explanation || null,
        why_correct: row.why_correct || null,
        why_selected_wrong:
          selected === correct ? null : row[`why_${selected.toLowerCase()}_wrong`] || null,
        why_a_wrong: row.why_a_wrong || null,
        why_b_wrong: row.why_b_wrong || null,
        why_c_wrong: row.why_c_wrong || null,
        why_d_wrong: row.why_d_wrong || null,
        exam_keyword: row.exam_keyword || null,
        memory_rule: row.memory_rule || null,
        trap: row.trap || null,
        source_name: row.source_name || null,
        source_url: row.source_url || null,
        verified: Boolean(row.verified),
        topic: row.topic,
        difficulty: row.difficulty,
      };
      return toolResult(result);
    }
  );

  server.registerTool(
    'get_review_queue',
    {
      title: 'Fila de revisão',
      description:
        'Retorna questões marcadas como errei/revisar, sem gabaritos. ' +
        'Útil para montar uma sessão de revisão direcionada.',
      inputSchema: z.object({
        exam: z.string().default('DP-300'),
        day: z.number().int().min(1).max(99).optional(),
        limit: z.number().int().min(1).max(25).default(10),
        include_decoreba: z.boolean().default(false),
      }),
      annotations: readAnnotations,
      securitySchemes,
    },
    async ({ exam, day, limit, include_decoreba }) => {
      const normalizedExam = normalizeExam(exam);
      const normalizedDay = normalizeDay(day);
      if (!normalizedExam) throw new Error('Exame inválido. Use DP-XXX.');
      const d = daySql(normalizedDay, 'q');

      const rows = await withDb(async (pool) => {
        const req = pool.request()
          .input('uid', sql.NVarChar(50), mappedUser.user_id)
          .input('exam', sql.NVarChar(20), normalizedExam)
          .input('limit', sql.Int, Number(limit));
        if (d.prefix) req.input('dayPrefix', sql.NVarChar(100), d.prefix);

        const r = await req.query(`
          SELECT TOP (@limit)
            q.id,q.exam,q.question,q.option_a,q.option_b,q.option_c,q.option_d,
            q.topic,q.difficulty,q.status,q.last_reviewed
          FROM dbo.dp300_questions q
          WHERE q.user_id=@uid AND q.exam=@exam
            AND q.status IN ('errei','revisar')
            ${d.clause}
            ${noDecorebaSql(include_decoreba, 'q')}
          ORDER BY
            CASE WHEN q.status='errei' THEN 0 ELSE 1 END,
            CASE WHEN q.last_reviewed IS NULL THEN 0 ELSE 1 END,
            q.last_reviewed ASC,
            q.id ASC
        `);
        return r.recordset;
      });

      return toolResult({
        exam: normalizedExam,
        day: normalizedDay,
        count: rows.length,
        questions: rows.map(publicQuestion),
      });
    }
  );

  return server;
}

module.exports = async function handler(req, res) {
  try {
    assertEnv();

    if (req.method === 'GET') {
      return res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Use POST for Streamable HTTP MCP.' },
        id: null,
      });
    }

    if (req.method === 'DELETE') {
      return res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Stateless MCP: DELETE not supported.' },
        id: null,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).end();
    }

    const authUser = await verifyAccessToken(req);
    const mappedUser = await resolveMappedUser(authUser.sub);

    const [{ StreamableHTTPServerTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/server/streamableHttp.js'),
    ]);

    const server = await createServer(mappedUser);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      Promise.resolve(transport.close()).catch(() => {});
      Promise.resolve(server.close()).catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('[mcp] error:', e);

    if (e && e.challenge && !res.headersSent) {
      res.setHeader('WWW-Authenticate', e.challenge);
    }

    if (!res.headersSent) {
      const status = e && e.statusCode ? e.statusCode : 500;
      return res.status(status).json({
        jsonrpc: '2.0',
        error: {
          code: status === 401 ? -32001 : status === 403 ? -32003 : -32603,
          message: status >= 500 ? 'Internal server error' : e.message,
        },
        id: null,
      });
    }
  }
};
