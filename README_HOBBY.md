DP-300 REAL — versão compacta para Vercel Hobby

OBJETIVO
Reduzir a quantidade de Serverless Functions.

ANTES
- 6 funções separadas em /api/exam/*
- helpers dentro de /api/_lib
- endpoints MCP antigos ainda podiam permanecer no projeto

AGORA
- /api/exam.js = UMA função para start/session/answer/mark/submit/pool
- helpers ficam em /lib (fora de /api)
- URLs antigas continuam funcionando por rewrites do vercel.json
- MCP antigo pode ser removido

FUNÇÕES DESTA VERSÃO
1. api/attempts.js
2. api/exam.js
3. api/gemini-sync.js
4. api/questions.js
5. api/questions/[id].js
6. api/questions/import.js

PASSOS
1. Na raiz do projeto, rode cleanup-hobby.ps1 OU apague manualmente:
   - api/exam/
   - api/_lib/
   - api/mcp.js
   - api/mcp-health.js
   - api/oauth-protected-resource.js

2. Copie por cima do projeto:
   - api/
   - lib/
   - public/
   - vercel.json

3. Não rode novamente o SQL 002 se ele já foi executado sem erro.

4. Commit + push.

5. Abra /real.html.

As rotas antigas /api/exam/start etc. continuam válidas.
