# Exportar PDF - v9

Nova aba **Exportar PDF** usa as questões já existentes no banco.

Filtros:
- quantidade
- assunto/palavras-chave
- tópico
- respondidas/não respondidas e status
- origem V2/REAL ou existente/legacy
- Decoreba
- tipo de questão
- dificuldade
- ordem aleatória/ID/tópico/status

Conteúdo opcional:
- sem gabarito, gabarito após cada questão ou gabarito no final
- explicação
- justificativa das alternativas incorretas
- palavra-chave/regra/pegadinha
- fonte/URL
- status/metadados
- contexto de case study

Formatos ricos são convertidos para representação textual adequada ao PDF.
A geração acontece no navegador com html2pdf.js e não cria novas Serverless Functions.
