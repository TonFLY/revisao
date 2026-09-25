# Estudo de caso: proteger um workload de busca semântica de varejo no Azure SQL

**Tempo estimado: 20 minutos**

Uma empresa de varejo quer adicionar busca semântica de produtos ao seu catálogo. O catálogo possui 8 milhões de SKUs. O plano inicial de embeddings usa 1.536 dimensões em precisão simples, atualizados todas as noites por um elastic job. O tráfego da aplicação consulta esses embeddings durante as pesquisas.

Errar essas decisões tem consequências reais: uma API key vazada ou uma conta com permissões excessivas é exatamente o tipo de falha que transforma um recurso de IA em um vazamento de dados, e um tier subdimensionado pode obrigar uma migração emergencial poucas semanas depois da entrada em produção. Por isso, o design de pré-produção é uma responsabilidade compartilhada entre DBA e desenvolvedores, e não algo a ser pensado depois.

Neste exercício, você analisará as cinco decisões de pré-produção que todo DBA precisa assumir em um workload como este. É um walkthrough de design, e não um deployment prático: você raciocinará sobre cada decisão e revisará o código de referência produzido, mas não executará nada e não precisará de uma assinatura do Azure. Adapte os nomes de placeholder (`sql-retail-prod`, `<openai-resource>` e assim por diante) quando aplicar o padrão a um workload real.

As cinco decisões são: **dimensionar o workload vetorial**, **autenticar com uma managed identity**, **definir os objetos de modelo externo**, **aplicar roles de least privilege** e **habilitar audit e Defender**. Cada seção aborda uma dessas decisões.

## Decisão 1: dimensionar o workload vetorial

Preencha a planilha abaixo para o cenário:

| Entrada | Valor |
|---|---|
| Linhas | 8.000.000 |
| Dimensões | 1.536 |
| Precisão | float32 |
| Tamanho do vetor por linha | 6 KB |
| Armazenamento total da coluna vetorial | **?** |
| Overhead estimado do índice vetorial (~50%) | **?** |
| Armazenamento total relacionado à IA | **?** |
| Tier recomendado | **?** |

### Pedir ao Copilot para estimar o dimensionamento

Em vez de fazer os cálculos manualmente, você pode pedir ao GitHub Copilot no SSMS — ou ao Copilot no Azure portal — que faça isso. No chat do Copilot, cole um prompt que contenha as entradas conhecidas:

> "I'm planning a vector column in Azure SQL. I have 8,000,000 rows, each storing a 1,536-dimension embedding at float32 (4 bytes per dimension). Estimate the per-row vector size, the total vector column storage, vector index overhead at about 50%, and the total AI-related storage. Then recommend an Azure SQL service tier for a read-heavy nightly-refresh-plus-search workload."

O Copilot retornará o tamanho por linha, os totais e uma recomendação de tier acompanhada do raciocínio. O resultado provavelmente será diferente dos cálculos apresentados abaixo — e esse é justamente o objetivo. Muitos modelos dimensionam usando apenas o payload bruto, aproximadamente 48 GB, e deixam de considerar a alocação de páginas do SQL Server. Compare os dois resultados e observe se o Copilot considerou o footprint completo por página. Trate a resposta como ponto de partida e valide os números usando o cálculo explicado abaixo.

> [!TIP]
> Sempre confirme a aritmética e as premissas do Copilot. Faça perguntas adicionais como "Show your calculation step by step" para conferir cada valor e "How would your tier recommendation change if the catalog grew to 50 million rows?" para testar a robustez do design.

Entenda o cálculo para verificar a estimativa do Copilot:

- **Coluna vetorial total:** um vetor `float32` de 1.536 dimensões tem aproximadamente 6 KB de payload — 1.536 × 4 bytes + um header de 8 bytes. Porém, uma data page do SQL armazena somente 8.060 bytes, e um vetor desse tamanho força **um vetor por página**. Assim, cada linha consome uma página completa de aproximadamente 8 KB. Footprint real em disco ≈ 8.000.000 × 8 KB ≈ **64 GB**, e não os 48 GB sugeridos pelo cálculo de payload bruto.
- **Overhead do índice vetorial em aproximadamente 50% da coluna:** ≈ **32 GB**.
- **Armazenamento total relacionado à IA:** ≈ **96 GB**.
- **Tier recomendado:** **General Purpose, 40-vCore** atende o footprint de armazenamento e o padrão de consultas read-heavy com atualização noturna e pesquisa interativa. Escolha **Hyperscale** se houver expectativa de o catálogo ultrapassar aproximadamente 50 milhões de SKUs em 12 meses, pois o Hyperscale desacopla o crescimento de storage da escala de compute.

> [!NOTE]
> Alterar a coluna para half-precision (`float16`, 2 bytes por dimensão) reduz aproximadamente pela metade tanto o footprint da coluna quanto o do índice e permite armazenar mais vetores por página. Vale considerar essa opção em catálogos grandes, pois embeddings geralmente toleram bem a pequena perda de precisão.

A próxima decisão é como o banco de dados comprovará sua identidade para o Azure OpenAI sem armazenar um segredo.

## Decisão 2: autenticar com uma managed identity

O logical server precisa de uma identidade que o Azure OpenAI aceite. O design habilita a system-assigned managed identity e concede a ela a role RBAC correta no recurso Azure OpenAI. A configuração é semelhante à seguinte:

```bash
az sql server update \
  --name sql-retail-prod \
  --resource-group rg-retail \
  --identity-type SystemAssigned
```

```bash
SQL_MI_ID=$(az sql server show \
  --name sql-retail-prod \
  --resource-group rg-retail \
  --query identity.principalId -o tsv)

az role assignment create \
  --assignee $SQL_MI_ID \
  --role "Cognitive Services OpenAI User" \
  --scope <azure-openai-resource-id>
```

Com essa configuração, nenhum segredo foi criado e não existe API key. A identidade do servidor constitui todo o caminho de autenticação até o Azure OpenAI.

> [!NOTE]
> `Cognitive Services OpenAI User` é a role de menor privilégio para um Azure SQL Database que apenas *chama* o endpoint de embeddings. Se você executar esse padrão no SQL Server 2025 conectado por Azure Arc, a documentação exige a role mais abrangente `Cognitive Services OpenAI Contributor` para a managed identity habilitada pelo Arc.

Com a identidade configurada, a próxima decisão conecta essa identidade aos objetos do banco que realmente chamam o modelo.

## Decisão 3: definir os objetos de modelo externo

Antes de qualquer chamada ao modelo externo funcionar, duas opções de configuração precisam ser habilitadas no servidor: o external REST endpoint e, como este design autentica com managed identity, as server-scoped database credentials:

```sql
EXECUTE sp_configure 'external rest endpoint enabled', 1;
RECONFIGURE WITH OVERRIDE;

EXECUTE sp_configure 'allow server scoped db credentials', 1;
RECONFIGURE WITH OVERRIDE;
```

Dentro do banco, três objetos dão suporte ao modelo externo: a master key — caso ainda não exista —, a credential vinculada à managed identity e o próprio external model. O script que os define é semelhante ao seguinte:

```sql
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE [name] = '##MS_DatabaseMasterKey##')
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = N'<strong-password>';

-- The credential name must be the protocol + FQDN of the endpoint the model calls.
CREATE DATABASE SCOPED CREDENTIAL [https://<openai-resource>.openai.azure.com]
WITH IDENTITY = 'Managed Identity',
     SECRET = '{"resourceid": "https://cognitiveservices.azure.com"}';

CREATE EXTERNAL MODEL Ada2Embeddings
WITH (
    LOCATION = 'https://<openai-resource>.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15',
    API_FORMAT = 'Azure OpenAI',
    MODEL_TYPE = EMBEDDINGS,
    MODEL = 'text-embedding-ada-002',
    CREDENTIAL = [https://<openai-resource>.openai.azure.com]
);
```

O valor `LOCATION` fixa o modelo em um deployment e uma versão específica da API. Se você alterar o deployment, atualiza o objeto de modelo, e não o código de todos os consumidores.

O objeto de modelo existe, mas neste momento qualquer usuário do banco poderia chamá-lo. A próxima decisão restringe isso apenas às contas que realmente precisam desse acesso.

## Decisão 4: aplicar grants com least privilege

O design de roles prevê dois principals, cada um com exatamente as permissões necessárias e nada além disso. Os grants são semelhantes aos seguintes:

```sql
-- Refresh service account
CREATE USER [embedding_refresh_svc] WITHOUT LOGIN;
GRANT EXECUTE ON EXTERNAL MODEL::Ada2Embeddings TO [embedding_refresh_svc];
GRANT REFERENCES ON DATABASE SCOPED CREDENTIAL::[https://<openai-resource>.openai.azure.com] TO [embedding_refresh_svc];
GRANT INSERT, UPDATE ON dbo.ProductEmbeddings TO [embedding_refresh_svc];

-- Query user: NO external endpoint permissions
CREATE USER [app_query_user] WITHOUT LOGIN;
GRANT SELECT ON dbo.ProductEmbeddings TO [app_query_user];
```

O query user não possui caminho até o Azure OpenAI. As consultas de pesquisa leem diretamente os vetores armazenados. Somente o job noturno de atualização acessa o endpoint externo.

Com as permissões devidamente limitadas, a decisão final torna cada chamada externa observável, permitindo provar o que aconteceu e detectar aquilo que não deveria acontecer.

## Decisão 5: habilitar audit e Defender

A decisão final habilita SQL Audit para o external model e Microsoft Defender for SQL no servidor:

```sql
CREATE SERVER AUDIT [AuditAIOperations]
TO URL (PATH = 'https://<staudit>.blob.core.windows.net/<container>');

ALTER SERVER AUDIT [AuditAIOperations] WITH (STATE = ON);

CREATE DATABASE AUDIT SPECIFICATION [AIDatabaseAudit]
FOR SERVER AUDIT [AuditAIOperations]
ADD (EXECUTE ON EXTERNAL MODEL::[Ada2Embeddings] BY [public])
WITH (STATE = ON);
```

```bash
az security pricing create --name SqlServers --tier Standard
```

> [!NOTE]
> Versões recentes do Azure CLI expressam o plano do Defender for SQL por meio das configurações de plano do Microsoft Defender for Cloud, em vez de um tier Standard/Free. Verifique `az security pricing` na sua versão atual do CLI ou habilite o plano pelo portal do Defender for Cloud.

> [!TIP]
> Ao aplicar esse padrão em um ambiente real, valide o fluxo ponta a ponta com uma única geração de embedding antes de considerar o baseline de segurança completo. Se `AI_GENERATE_EMBEDDINGS` retornar com sucesso **e** o audit log registrar a chamada feita por `embedding_refresh_svc`, o baseline está funcionando. Se a linha de auditoria não aparecer, corrija isso antes de permitir que o job noturno execute de verdade.

## Erros comuns a evitar

Cada um dos anti-patterns abaixo seria apontado em uma revisão real. Compare a abordagem incorreta com o design analisado neste exercício:

| Anti-pattern (incorreto) | O que dá errado | Faça isto em vez disso (correto) |
|---|---|---|
| Armazenar a **API key do Azure OpenAI em uma connection string** ou configuração da aplicação | O segredo fica em source control, logs e ambientes de desenvolvedores — um vazamento expõe o endpoint | Use uma **system-assigned managed identity**; não existe segredo para vazar (Decisão 2) |
| Conceder ao **query user interativo `EXECUTE` no external model** | O caminho de pesquisa passa a poder disparar chamadas pagas de embedding e alcançar o endpoint externo, ampliando a superfície de ataque | Conceda ao query user somente **`SELECT`** na tabela de embeddings; reserve acesso ao modelo para a conta de refresh (Decisão 4) |
| **Pular a database master key** antes de criar a scoped credential | `CREATE DATABASE SCOPED CREDENTIAL` falha ou a credential não pode ser protegida | Crie primeiro a master key, protegida por `IF NOT EXISTS` (Decisão 3) |
| Esquecer de habilitar **`external rest endpoint enabled`** / `allow server scoped db credentials` | A chamada ao external model falha em runtime com erro de configuração | Habilite ambas as opções com `sp_configure` antes de definir o modelo (Decisão 3) |
| **Dimensionar apenas pelo payload bruto** (1.536 × 4 bytes) e ignorar page allocation | O banco fica sem espaço porque cada vetor grande consome uma página completa | Dimensione usando o footprint real **por página** e adicione o overhead do índice (Decisão 1) |
| Entrar em produção sem **auditing ou Defender** | Não há registro de quem chamou o modelo nem alertas de ameaças — uma lacuna de compliance e resposta a incidentes | Habilite SQL Audit no external model e Microsoft Defender for SQL (Decisão 5) |

## Scorecard das decisões

Use este scorecard como um resumo reutilizável do design. Para um workload real, substitua os valores e nomes de recursos pelos seus próprios.

| Decisão | Escolha recomendada | Por quê |
|---|---|---|
| **Dimensionar o workload vetorial** | General Purpose, 40-vCore (~96 GB de armazenamento relacionado à IA) | Atende o footprint de armazenamento e o padrão read-heavy com atualização noturna e pesquisa. Migre para Hyperscale se o catálogo ultrapassar ~50 milhões de SKUs em 12 meses. |
| **Autenticar no Azure OpenAI** | System-assigned managed identity + role `Cognitive Services OpenAI User` | Nenhum segredo precisa ser armazenado, rotacionado ou pode vazar; o Microsoft Entra ID emite a credencial e RBAC governa o acesso. |
| **Definir o external model** | Master key, database scoped credential e external model | Vincula o banco a um deployment e versão de API; os consumidores referenciam um único objeto de modelo. |
| **Limitar permissões** | `embedding_refresh_svc` (caminho de refresh) e `app_query_user` (somente leitura) | Least privilege — somente o job noturno acessa o endpoint externo; a pesquisa lê vetores armazenados. |
| **Monitorar operações** | SQL Audit no external model + Microsoft Defender for SQL | Registro verificável das operações de IA e alertas proativos de ameaça para compliance e resposta a incidentes. |

## Validar as decisões de design

Responda às perguntas abaixo com base no estudo de caso de busca semântica de varejo. Escolha uma resposta para cada pergunta e depois expanda **Mostrar resposta** para conferir seu raciocínio.

**1. O logical server autentica no Azure OpenAI usando uma system-assigned managed identity. Por que isso é preferível a armazenar uma API key no banco de dados?**

- **A.** Managed identities fazem as consultas de embedding executarem mais rápido.
- **B.** Não existe segredo para armazenar, rotacionar ou vazar — o Microsoft Entra ID emite e rotaciona a credencial automaticamente, e o acesso é governado por RBAC.
- **C.** API keys não são suportadas pelo Azure SQL Database.

<details markdown="1">
<summary>Mostrar resposta</summary>

✅ **Resposta correta: B.** Não existe segredo para armazenar, rotacionar ou vazar — o Microsoft Entra ID emite e rotaciona a credencial automaticamente, e o acesso é governado por RBAC.

Com uma managed identity, não existe API key em nenhum ponto do banco ou da aplicação. A identidade do servidor é todo o caminho de autenticação, então não há segredo para vazar em source control ou connection string, e o acesso pode ser concedido ou revogado alterando uma role assignment do RBAC. Managed identities não alteram a performance das consultas, e API keys são tecnicamente suportadas — apenas representam uma postura de segurança mais fraca.

</details>

**2. No design de roles, o `app_query_user`, que atende a pesquisa interativa, recebe `SELECT` em `dbo.ProductEmbeddings`, mas nenhuma permissão no external model ou na credential. Por quê?**

- **A.** As consultas de pesquisa leem diretamente os vetores armazenados, então o query user não precisa chamar o endpoint externo — somente o job noturno de atualização precisa.
- **B.** Conceder `SELECT` inclui automaticamente acesso ao external model.
- **C.** O query user não pode receber permissões de external model no Azure SQL.

<details markdown="1">
<summary>Mostrar resposta</summary>

✅ **Resposta correta: A.** As consultas de pesquisa leem diretamente os vetores armazenados, então o query user nunca precisa chamar o endpoint externo — somente o job noturno de atualização precisa.

Isso é least privilege na prática. Os embeddings são gerados uma vez por noite por `embedding_refresh_svc` e armazenados na tabela. A pesquisa interativa compara os vetores armazenados usando um simples `SELECT`, portanto o query user não possui caminho até o Azure OpenAI. Limitar a permissão de endpoint externo à única conta de refresh reduz a superfície de ataque e a possível exposição de custos.

</details>

**3. A database scoped credential é chamada `[https://<openai-resource>.openai.azure.com]`. Qual regra esse nome segue?**

- **A.** O nome pode ser qualquer string descritiva escolhida pelo DBA.
- **B.** O nome deve ser o protocolo mais o fully qualified domain name (FQDN) do endpoint chamado pelo modelo.
- **C.** O nome deve corresponder ao nome do deployment do Azure OpenAI.

<details markdown="1">
<summary>Mostrar resposta</summary>

✅ **Resposta correta: B.** O nome deve ser o protocolo mais o fully qualified domain name (FQDN) do endpoint chamado pelo modelo.

O Azure SQL associa a credential a uma chamada de saída usando a URL, portanto o nome da credential precisa ser o protocolo e o FQDN do endpoint de destino — por exemplo, `https://<openai-resource>.openai.azure.com`. O deployment específico e a versão da API são fixados no `LOCATION` do external model, e não no nome da credential.

</details>

**4. O catálogo possui hoje 8 milhões de SKUs e cabe confortavelmente em um tier General Purpose de 40 vCores. Em que condição o estudo de caso recomenda Hyperscale?**

- **A.** Sempre que o banco usar vector search.
- **B.** Somente se o workload precisar gerar embeddings em tempo real em todas as consultas.
- **C.** Se houver expectativa de o catálogo ultrapassar aproximadamente 50 milhões de SKUs em 12 meses, porque o Hyperscale desacopla o crescimento de storage da escala de compute.

<details markdown="1">
<summary>Mostrar resposta</summary>

✅ **Resposta correta: C.** Se houver expectativa de o catálogo ultrapassar aproximadamente 50 milhões de SKUs em 12 meses, porque o Hyperscale desacopla o crescimento de storage da escala de compute.

General Purpose atende o footprint atual de aproximadamente 96 GB relacionado à IA e o padrão read-heavy com atualização noturna e pesquisa. Hyperscale se torna a escolha mais adequada quando o armazenamento deve crescer rapidamente, pois permite que storage escale de forma independente do compute. O uso de vector search por si só não exige Hyperscale, e o design deste caso armazena embeddings em vez de gerá-los em cada consulta.

</details>
