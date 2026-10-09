# Cursos SQL

A aba Cursos SQL incorpora 43 módulos, 345 aulas e 347 materiais. O catálogo é estático em public/courses/catalog.json; o SQL 004 contém o mesmo catálogo. Atualizações posteriores devem manter ambos consistentes.

Execute sql/004_cursos_sql.sql no banco DB_NAME, usando a versão com AS [references] na consulta final. Não há outra migração nem variável de ambiente nova.

## Acesso e perfis

O progresso é vinculado apenas ao nome do perfil, usando uid como nas outras abas. O mesmo nome em outro navegador recupera o mesmo progresso. Não há senha ou chave: qualquer pessoa que escolher o mesmo nome pode ler e alterar esse progresso. Permissões dos vídeos continuam sendo controladas pelo Google Drive. A cópia local da versão anterior é importada para o nome do perfil na primeira abertura, sem apagar registros antigos no banco.

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

## Windows offline
Abra `/courses.html` no Chrome/Edge enquanto conectado, escolha seu mesmo nome de usuário e clique em **Preparar página para uso offline**. Salve essa URL nos favoritos. A página, catálogo e scripts são armazenados pelo service worker; APIs, vídeos e materiais não são enviados nem armazenados nesse cache. Não há nova função Vercel nem migração SQL.

No Drive para computador, marque `G:\Meu Drive\Cursos SQL - Extraidos` como **Disponível offline** e aguarde a conclusão. Selecione essa pasta pelo controle da página a cada sessão (o navegador não pode selecionar o caminho automaticamente). A correspondência usa caminho relativo exato normalizado e tamanho catalogado, sem aproximação por nome. Confira os totais e teste uma aula com a internet desligada. O seletor verifica metadados; a leitura integral e compatibilidade de cada vídeo dependem do Windows/navegador. Anexos permanecem compactados. A página autônoma conserva o mesmo armazenamento de progresso por nome usado na aba; ao voltar a conexão, sincroniza pendências, preservando alterações locais durante a leitura remota.

A preparação deve terminar antes de sair da internet; limpar dados do navegador remove página/progresso local. Exporte o progresso como cópia de segurança. Drive e atalhos `.url` exigem conexão. Testes automatizados verificam caminhos e isolamento do cache, mas a reprodução real e a interface ainda precisam ser conferidas no Windows do usuário.
