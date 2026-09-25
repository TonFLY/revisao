# Converter um schema Oracle para Azure Database for PostgreSQL

**Tempo estimado: 30 minutos**

Neste exercício, você executará uma conversão de schema de ponta a ponta do Oracle para o Azure Database for PostgreSQL flexible server: criará um projeto de migração, executará o pipeline de conversão, interpretará o relatório de conversão, resolverá uma tarefa de revisão **Mandatory** usando o modo agente do GitHub Copilot e localizará o `deploy.sql` gerado.

Você executará este exercício no seu próprio ambiente, em vez de usar um sandbox pré-configurado, porque a ferramenta lê os metadados do schema diretamente de um data dictionary Oracle ativo e valida os objetos convertidos em um Azure Database for PostgreSQL flexible server real.

> [!NOTE]
> Este exercício é executado em um ambiente ativo. Antes de começar, confirme que você possui:
>
> - A extensão **PostgreSQL** para Visual Studio Code instalada e com login realizado.
> - Um banco de dados Oracle de origem acessível, com um usuário de migração que possua `SELECT_CATALOG_ROLE` e acesso de leitura a `SYS.ARGUMENT$`.
> - Um Azure Database for PostgreSQL flexible server para ser usado como scratch database, com as extensões necessárias ao seu schema incluídas na allowlist e instaladas.
> - Um deployment no Microsoft Foundry de um chat model atualmente suportado, com capacidade suficiente de tokens por minuto (TPM) para o seu schema.
> - A role **Cognitive Services OpenAI User** no recurso do Foundry para a identidade usada no login, para que a autenticação do Microsoft Entra ID seja bem-sucedida.
>
> Se algum desses componentes estiver ausente, configure-o antes de começar.

## Provisionar o ambiente do laboratório

Esta seção **não é obrigatória**, mas é recomendada se você precisar de uma maneira rápida de provisionar o ambiente do laboratório.

Se você ainda não tiver a origem Oracle, o PostgreSQL flexible server e o deployment do Microsoft Foundry, um template comunitário **Deploy to Azure** poderá provisionar todo o ambiente para você. Se você estiver usando seu próprio ambiente, pule esta seção — apenas confirme que ele atende aos pré-requisitos acima.

<a href="https://github.com/MicrosoftLearning/mslearn-postgresql/tree/main/Allfiles/Deploy" style="display:inline-block; padding:10px 16px; background-color:#0063B1; color:#FFFFFF; text-decoration:none; border-radius:4px; font-weight:600;">Provisionar o ambiente aqui</a>

## Criar o projeto de migração

O Migration Wizard coleta tudo de que a conversão precisa em quatro etapas: um nome de projeto, a origem Oracle, o scratch database e o modelo do Microsoft Foundry.

1. Na extensão PostgreSQL, abra a exibição **Migrations (preview)** e selecione **Create Migration Project**.
1. Em **Project Setup**, informe um nome para o projeto e selecione **Next**.
1. Em **Connect to Oracle**, informe o host, a porta e o service name do Oracle, juntamente com as credenciais do usuário de migração. Selecione **Load Schemas**, escolha o schema que deseja converter e selecione **Next**.
1. Na etapa do scratch database, selecione sua conexão do Azure Database for PostgreSQL e o banco de dados de destino, selecione **Verify Extensions** e depois **Next**.
1. Na etapa do Microsoft Foundry, informe seu endpoint e o nome do deployment do chat model e selecione **Microsoft Entra ID** para autenticação.
1. Selecione **Test Connection**. Depois que a verificação for bem-sucedida, selecione **Create Migration Project**.

> [!NOTE]
> Se **Verify Extensions** informar que há extensões ausentes, inclua-as na allowlist por meio do parâmetro de servidor `azure.extensions` no flexible server e tente novamente.

A ferramenta seleciona automaticamente o modo de cliente thin ou thick com base na configuração de rede do Oracle. Assim, a conexão é estabelecida sem etapas adicionais, a menos que a criptografia de rede nativa exija o Oracle Instant Client.

## Executar a conversão do schema

O assistente abre o painel principal de conversão com um card **Schema Migration** que acompanha a execução.

1. No card **Schema Migration**, selecione **Migrate** para iniciar a conversão.
1. Observe o pipeline avançar pelas etapas: *Extracting* lê o data dictionary Oracle, e *Converting* transforma o DDL em lotes com o modelo do Microsoft Foundry e o valida em scratch schemas.
1. Aguarde a mensagem **Migration Complete**. A ferramenta cria e remove automaticamente scratch schemas cujo nome utiliza o prefixo `_mig_scratch_` durante a validação.
1. Selecione **View Migration Report** para abrir os relatórios gerados.

A execução pode levar de alguns minutos a mais de uma hora, dependendo do tamanho do schema, da complexidade do PL/SQL e da capacidade de TPM do Microsoft Foundry. A ferramenta processa os objetos em lotes cientes das dependências, portanto os tipos são convertidos antes das tabelas que os utilizam, e as funções são convertidas antes dos triggers que as chamam.

## Interpretar o relatório de conversão

Abra primeiro `reports/customer_summary.md`. Ele apresenta a decisão geral de prontidão antes que você examine cada objeto individualmente.

O resumo informa o status geral da conversão, a porcentagem de sucesso e a quantidade de objetos sinalizados para revisão por criticidade: **Mandatory**, **Recommended** e **Optional**. Anote sua porcentagem de sucesso e a quantidade de tarefas **Mandatory**. A seção **Next actions** orienta a resolver as tarefas Mandatory antes do deployment.

> [!NOTE]
> A porcentagem de sucesso representa a cobertura da conversão automatizada, e não a prontidão para deployment. Os objetos convertidos automaticamente ainda precisam ser validados por você, e as tarefas de revisão representam o trabalho restante antes de o schema estar pronto para produção.

Para obter uma análise por objeto com trechos de DDL, abra `reports/technical_conversion_report.md`. Trate `reports/review_tasks.md` apenas como referência offline e resolva as tarefas pelo painel **Schema Review**.

## Fazer a triagem das tarefas de revisão

Abra o painel **Schema Review** para trabalhar com os objetos sinalizados. Comece na exibição **Grouped** para ver as tarefas organizadas por categoria de comportamento, como **Numeric Semantics** e **Empty String / NULL**; depois mude para a exibição **Tasks** para filtrá-las e resolvê-las uma a uma.

1. Na exibição **Tasks**, defina o filtro **Status** como **Pending** e o filtro **Priority** como **Mandatory**.
1. Selecione uma tarefa Mandatory para abrir os detalhes, incluindo o DDL de origem, o DDL PostgreSQL gerado e as evidências da tarefa.

Uma tarefa é **Mandatory** quando o objeto não está pronto para produção até que você trate o problema. Um exemplo comum é uma função Oracle que retorna `NUMBER` sem qualificação, o que pode ser mapeado de forma ambígua para `numeric`, `integer` ou `bigint` no PostgreSQL. Quando o valor participa de um cálculo, um mapeamento para inteiro truncaria resultados fracionários; por isso, você deve escolher o tipo correto antes do deployment.

## Resolver uma tarefa Mandatory com o modo agente do GitHub Copilot

Resolva a tarefa com assistência guiada e, em seguida, valide o resultado por conta própria.

1. Com a tarefa aberta, selecione **Run Task** para abrir o modo agente do GitHub Copilot com o DDL de origem, o DDL PostgreSQL gerado e as evidências da tarefa carregados como contexto.
1. Revise a correção proposta. O Copilot sugere uma alteração baseada nas evidências, como mapear um `NUMBER` ambíguo para `numeric` com precisão e escala explícitas.
1. Aplique a correção ao arquivo `.sql` gerado em `postgres_ddl/<schema>/<object_type>/`.
1. Conecte-se ao scratch database e execute o arquivo `.sql` atualizado para confirmar que ele compila.
1. Selecione **Resolve** para marcar a tarefa como concluída e avance para a próxima tarefa Mandatory.

> [!IMPORTANT]
> A mesma IA que converte um objeto de schema também pode ajudar a revisá-lo, e sistemas de IA podem ocasionalmente confirmar os próprios erros. Valide de forma independente cada resolução assistida por IA antes do deployment. Execute o objeto convertido com dados de teste representativos e confirme que o resultado corresponde à origem Oracle.

Resolver uma tarefa atualiza o arquivo `.sql` em `postgres_ddl/`, mas a alteração não é aplicada automaticamente ao scratch database. Execute você mesmo o arquivo atualizado para validar a correção antes de marcar a tarefa como resolvida.

## Localizar a saída de deployment

Cada execução grava sua saída em uma pasta de sessão em `artifacts/oracle/_migration/convert/sessions/<session-id>/`. Dois locais são especialmente importantes para o deployment:

- `postgres_ddl/<schema>/<object_type>/` contém um arquivo `.sql` para cada objeto convertido, agrupado por tipo. Esses são os arquivos que você edita e revalida ao resolver as tarefas.
- `deploy.sql` é o script consolidado que cria o schema de destino e aplica todos os objetos na ordem de dependência. Esse é o arquivo que você executa no destino de produção depois da validação independente.

> [!IMPORTANT]
> Uma correção executada diretamente no scratch database não é propagada para `deploy.sql`. Depois de tratar a causa raiz de uma tarefa, execute a conversão novamente para que a ferramenta regenere `deploy.sql` com a saída melhorada. Depois compare o novo relatório com o anterior para confirmar que a alteração produziu o efeito esperado.

Com `deploy.sql` gerado e as tarefas Mandatory resolvidas, o schema convertido está pronto para a validação independente e para o deployment de produção que acontecem após a conversão.

## O que você realizou

Você executou uma conversão de schema de ponta a ponta — criou o projeto de migração, executou o pipeline, interpretou o customer summary, resolveu uma tarefa de revisão Mandatory com o modo agente do GitHub Copilot e localizou `deploy.sql`. Você também confirmou os dois hábitos que mantêm confiável uma migração assistida por IA: validar cada resolução de forma independente e executar novamente a conversão, em vez de fazer correções manuais apenas no scratch database.
