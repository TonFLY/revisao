# Cursos SQL

A aba Cursos SQL incorpora 43 módulos, 345 aulas e 347 materiais. O catálogo é estático em public/courses/catalog.json; o SQL 004 contém o mesmo catálogo. Atualizações posteriores devem manter ambos consistentes.

Execute sql/004_cursos_sql.sql no banco DB_NAME, usando a versão com AS [references] na consulta final. Não há outra migração nem variável de ambiente nova.

## Acesso e perfis

O site atual identifica perfis por nome, sem autenticação de contas. Os cursos utilizam uma credencial aleatória de 256 bits por perfil neste navegador, enviada em Authorization, fora de URLs. A API deriva user_id com SHA-256 e não aceita uid para escolher registros de outra pessoa. A credencial fica no armazenamento local; limpar esse armazenamento perde a conexão com o progresso remoto. Outro navegador ou dispositivo recebe outra credencial, mesmo escolhendo o mesmo nome. Isso não substitui contas autenticadas; para sincronização de uma conta entre dispositivos será necessário integrar autenticação real. Perfis no mesmo navegador compartilhado não são protegidos uns dos outros por senha.

Progresso, favoritos e notas são separados no banco. A API usa parâmetros SQL, verifica IDs do catálogo e limita notas a 4000 caracteres e lotes a 25 registros. A cópia local é preservada em falhas, com indicação e opção de tentar novamente. Exportar/importar progresso não exporta a credencial.

Para assistir e baixar materiais, é necessário entrar na conta Google e ter permissão na pasta do Drive. O aviso permanente oferece o link para abrir a pasta e solicitar acesso; aprovação depende do responsável. A aplicação não concede permissão nem torna os arquivos públicos.

## Vercel Hobby

- Uma função nova: api/courses.js, GET/POST apenas para progresso.
- Catálogo, HTML, CSS e JS estáticos; sem consulta SQL para catálogo.
- Vídeos, PDFs e arquivos RAR/ZIP abrem diretamente no Drive, sem proxy pela Vercel.
- Nenhum cron, processamento de vídeos ou chamada a IA.
- Uma leitura de progresso ao abrir a aba; alterações explícitas gravadas em lotes. Notas só enviadas ao clicar Salvar anotações.
- Pool próprio reutilizado, máximo de duas conexões por instância; timeouts de conexão e consulta de oito segundos.
- O código atual possui dez entradas JavaScript em api, incluindo os dois helpers preexistentes em api/_lib. Não foram adicionados helpers em api.
- Conferir consumo real em Usage da Vercel; esta arquitetura reduz o uso, mas não garante que qualquer volume de usuários caiba na franquia.

Testes: node --test tests/courses.test.js. Não executam contra o SQL real. A reprodução do Drive e o deploy na Vercel precisam de teste com as contas e permissões do ambiente.
