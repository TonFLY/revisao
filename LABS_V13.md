# V13 — Aba Labs DP-300

Implementado:
- aba `Labs DP-300`;
- catálogo unificado com 21 itens (setup + Labs 1–18 + 2 Azure SQL Labs);
- títulos, módulos, resumo e roteiro em português;
- filtros por status, domínio, fonte e busca;
- status Não iniciado / Em andamento / Concluído;
- checkbox na lista e no laboratório;
- data de conclusão e botão Continuar último laboratório;
- progresso por `user_id`;
- `/api/labs.js`;
- `sql/003_labs_progress.sql`;
- fallback localStorage se a tabela ainda não existir;
- links para fonte oficial e licença;
- original MicrosoftLearning pode ser exibido na própria aba.

O renderer já aceita `content_html_pt` no catálogo para a tradução integral de cada lab.
