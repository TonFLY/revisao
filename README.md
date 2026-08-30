# DP-300 Review System

Sistema de revisão com **flashcards de múltipla escolha** para a certificação **Microsoft DP-300**.

**Stack:** Vercel Serverless Functions (Node.js + mssql) · Frontend HTML/CSS/JS puro

---

## Estrutura de arquivos

```
├── api/
│   ├── questions.js        ← GET (listar) + POST (criar)
│   └── questions/
│       └── [id].js         ← PUT (atualizar) + DELETE (excluir)
├── public/
│   └── index.html          ← frontend (servido como estático)
├── setup.sql               ← criação da tabela no SQL Server
├── package.json
├── vercel.json
└── README.md
```

---

## Deploy na Vercel

### 1. Criar a tabela no SQL Server

Execute [`setup.sql`](setup.sql) no banco `NossaRotina` antes de fazer o deploy:

```bash
sqlcmd -S 191.101.71.175,1433 -U sa -P "Aa##91684895" -d NossaRotina -i setup.sql
```

Ou abra no SSMS e execute.

### 2. Subir o projeto no GitHub

```bash
git add .
git commit -m "dp300 review system"
git push
```

### 3. Importar na Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub
3. Em **Environment Variables**, adicione as 5 variáveis abaixo
4. Clique em **Deploy**

### 4. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome | Valor |
|---|---|
| `DB_HOST` | `191.101.71.175` |
| `DB_PORT` | `1433` |
| `DB_NAME` | `NossaRotina` |
| `DB_USER` | `sa` |
| `DB_PASSWORD` | `Aa##91684895` |

> ⚠️ A porta 1433 precisa estar acessível publicamente no servidor SQL Server.  
> Verifique o firewall do servidor e que o SQL Server está ouvindo conexões TCP/IP externas.

---

## Rodar localmente (opcional)

```bash
npm install -g vercel
vercel dev
```

Acesse `http://localhost:3000`.

---

## Como funciona

| Aba | Descrição |
|---|---|
| **Estudar** | Flashcard com 4 alternativas — clique para responder, feedback imediato |
| **Questões** | Lista todas com gabarito destacado |
| **Adicionar** | Formulário para criar/editar questões |

### Filtros no modo Estudar
- **Todas** — todas as questões em ordem
- **Pendentes** — ainda não respondidas
- **Só erros** — status = errei
- **Revisar** — status = revisar
- **Embaralhar** — ordem aleatória

O status é salvo automaticamente no banco ao responder cada card.

---

## Formato de exportação JSON

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-15T14:30:00.000Z",
  "total": 1,
  "questions": [
    {
      "id": 1,
      "question": "Qual recurso garante alta disponibilidade com failover automático entre réplicas síncronas?",
      "option_a": "Log Shipping",
      "option_b": "Always On Availability Groups",
      "option_c": "Database Mirroring",
      "option_d": "Replication",
      "correct": "B",
      "explanation": "Always On AG suporta failover automático com réplicas síncronas.",
      "topic": "Alta Disponibilidade",
      "difficulty": "medio",
      "status": "acertei",
      "created_at": "2025-01-10T10:00:00.000Z",
      "updated_at": "2025-01-15T14:00:00.000Z",
      "last_reviewed": "2025-01-15T14:00:00.000Z"
    }
  ]
}
```

### Campos da questão

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `int` | Auto-gerado pelo banco |
| `question` | `string` | Enunciado |
| `option_a` … `option_d` | `string` | Alternativas A, B, C, D |
| `correct` | `"A"` \| `"B"` \| `"C"` \| `"D"` | Gabarito |
| `explanation` | `string` | Explicação (opcional) |
| `topic` | `string` | Tópico DP-300 |
| `difficulty` | `"facil"` \| `"medio"` \| `"dificil"` | Dificuldade |
| `status` | `"pendente"` \| `"acertei"` \| `"errei"` | Atualizado ao responder |
| `created_at` / `updated_at` / `last_reviewed` | `ISO 8601` | Datas |
