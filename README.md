# DP-300 Review System

Sistema de revisão com **flashcards de múltipla escolha** para a certificação **Microsoft DP-300**.

**Stack:** Node.js + Express + mssql → `server.js` · Frontend HTML/CSS/JS puro → `index.html`

---

## Início rápido

### 1. Criar a tabela no SQL Server

Execute [`setup.sql`](setup.sql) no banco `NossaRotina`:

```bash
sqlcmd -S 191.101.71.175,1433 -U sa -P "Aa##91684895" -d NossaRotina -i setup.sql
```

Ou abra o arquivo no SSMS e execute.

### 2. Instalar dependências

```bash
npm install
```

### 3. Iniciar

```bash
npm start
```

### 4. Abrir no navegador

```
http://localhost:3001
```

---

## Estrutura de arquivos

```
├── server.js      ← API (Node.js + Express + mssql)
├── index.html     ← frontend (HTML/CSS/JS puro)
├── setup.sql      ← criação da tabela
├── package.json
└── README.md
```

---

## Como funciona

| Aba | Descrição |
|---|---|
| **Estudar** | Flashcard com 4 alternativas — clique para responder, recebe feedback imediato |
| **Questões** | Lista todas as questões com as opções e gabarito destacado |
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
      "question": "Qual recurso do SQL Server garante alta disponibilidade com failover automático entre réplicas síncronas?",
      "option_a": "Log Shipping",
      "option_b": "Always On Availability Groups",
      "option_c": "Database Mirroring",
      "option_d": "Replication",
      "correct": "B",
      "explanation": "Always On AG suporta failover automático com réplicas síncronas. Log Shipping e Mirroring são legados. Replication não é solução de HA.",
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
| `question` | `string` | Enunciado da questão |
| `option_a` | `string` | Alternativa A |
| `option_b` | `string` | Alternativa B |
| `option_c` | `string` | Alternativa C |
| `option_d` | `string` | Alternativa D |
| `correct` | `"A"` \| `"B"` \| `"C"` \| `"D"` | Letra da alternativa correta |
| `explanation` | `string` | Explicação do gabarito (opcional) |
| `topic` | `string` | Tópico DP-300 |
| `difficulty` | `"facil"` \| `"medio"` \| `"dificil"` | Dificuldade |
| `status` | `"pendente"` \| `"acertei"` \| `"errei"` | Atualizado ao responder |
| `created_at` | `ISO 8601` | Gerado automaticamente |
| `updated_at` | `ISO 8601` | Atualizado a cada edição |
| `last_reviewed` | `ISO 8601` \| `null` | Última vez que foi respondida |

---

## API

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/api/questions` | Lista todas |
| `POST` | `/api/questions` | Cria nova |
| `PUT` | `/api/questions/:id` | Atualiza |
| `DELETE` | `/api/questions/:id` | Remove |
