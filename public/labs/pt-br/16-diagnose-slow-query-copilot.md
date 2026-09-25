# Diagnosticar uma consulta lenta com Copilot

**Tempo estimado: 20 minutos**

Você é o DBA do banco **ContosoOps**. A equipe de operações informa que `dbo.usp_GetOpenWorkOrdersByTechnician` está lenta — uma consulta que deveria retornar em milissegundos leva vários segundos. Seu trabalho é usar o GitHub Copilot no SSMS para investigar, gerar uma correção, validá-la e aplicá-la, seguindo o validation gate da unidade anterior.

## Pré-requisitos

- SSMS instalado com o workload **AI Assistance** — adicionado pelo Visual Studio Installer.
- Uma assinatura ativa do GitHub Copilot.
- Uma instância do SQL Server ou Azure SQL Database na qual você possa criar o banco **ContosoOps**.

> [!NOTE]
> Você também pode acompanhar este laboratório usando qualquer banco que contenha uma stored procedure com uma consulta lenta e baseada fortemente em scan. As etapas e os padrões de validação são os mesmos independentemente do schema.

---

## Configurar o ambiente

O script de setup cria e popula o banco **ContosoOps** usado durante todo este lab. Se os arquivos do laboratório já estiverem na pasta **C:\LabFiles**, você pode pular a clonagem; caso contrário, clone este repositório para **C:\LabFiles** antes de continuar.

1. Abra o SSMS e conecte à sua instância do SQL Server ou ao Azure SQL Database.

1. Abra o arquivo **C:\LabFiles\dp-300-database-administrator\Instructions\Templates\01-ContosoOps-Setup.sql** e selecione **Execute**. Esse script:

    - Cria o banco **ContosoOps**, as tabelas `Technicians` e `WorkOrders` e a stored procedure `dbo.usp_GetOpenWorkOrdersByTechnician`.
    - Insere aproximadamente 2 milhões de linhas em `WorkOrders` sem um índice de suporte, fazendo com que a stored procedure faça scan da tabela e execute lentamente.

    > &#128221; A etapa de carga insere aproximadamente 2 milhões de linhas e leva alguns minutos. Aguarde a mensagem **setup complete** antes de continuar.

---

## Abrir a consulta lenta no SSMS e analisar com GitHub Copilot

1. No SSMS, abra uma nova janela de consulta conectada ao banco **ContosoOps**.

1. Habilite **Include Actual Execution Plan** — ou pressione **Ctrl+M** — e execute a stored procedure com estatísticas de I/O e tempo habilitadas para confirmar que ela está lenta:

   ```sql
   SET STATISTICS IO ON;
   SET STATISTICS TIME ON;
   GO

   EXEC dbo.usp_GetOpenWorkOrdersByTechnician @TechnicianID = 42;
   GO

   SET STATISTICS IO OFF;
   SET STATISTICS TIME OFF;
   ```

   Anote os **logical reads** e o **elapsed time** na guia Messages — esse será seu baseline. No plano de execução, confirme a presença de um **table scan** — clustered index scan — em `WorkOrders`.

1. Abra a definição da stored procedure. No **Object Explorer**, expanda **ContosoOps** > **Programmability** > **Stored Procedures**, clique com o botão direito em `dbo.usp_GetOpenWorkOrdersByTechnician` e selecione **Modify** para visualizar o texto da consulta.

1. Selecione a instrução `SELECT` dentro da procedure, clique com o botão direito na seleção e escolha **Explain with Copilot**. O GitHub Copilot abrirá um painel de chat e descreverá a consulta. Na explicação, o Copilot identifica um table scan em `WorkOrders` causado por um predicado de filtro em `TechnicianID` e `Status` sem um índice de suporte.

---

## Pedir ao Copilot uma recomendação de índice

1. No chat do Copilot, digite:

   > "This query has a table scan on WorkOrders filtered by TechnicianID and Status. What index would you recommend?"

1. O Copilot responderá com uma recomendação de índice semelhante à seguinte:

    ```sql
    -- Copilot-suggested index
    CREATE NONCLUSTERED INDEX IX_WorkOrders_TechnicianID_Status
    ON dbo.WorkOrders (TechnicianID, Status)
    INCLUDE (WorkOrderID, OpenedDate, Description);
    ```

1. Leia a explicação fornecida pelo Copilot junto com o índice. Ela deverá descrever a ordem das colunas-chave — `TechnicianID` primeiro, como predicado de igualdade, e `Status` em seguida, como predicado de range ou igualdade — e explicar por que as colunas em `INCLUDE` evitam um key lookup.

> [!NOTE]
> As colunas de `INCLUDE` sugeridas pelo Copilot dependem das colunas que ele consegue inferir do texto da consulta. Se a stored procedure selecionar colunas adicionais que não estejam no contexto do Copilot, adicione-as à lista `INCLUDE` antes de criar o índice.

---

## Validar a recomendação

Antes de criar o índice, aplique o validation gate aprendido anteriormente.

1. Verifique se já existe um índice semelhante para evitar índices redundantes:

    ```sql
    -- Check for existing indexes on WorkOrders
    SELECT
        i.name             AS index_name,
        i.type_desc,
        c.name             AS column_name,
        ic.is_included_column,
        ic.key_ordinal
    FROM sys.indexes AS i
    JOIN sys.index_columns AS ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns       AS c  ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.WorkOrders')
    ORDER BY i.index_id, ic.key_ordinal;
    ```

    Se já existir um índice em `TechnicianID`, verifique se ele inclui `Status` e as colunas do `INCLUDE`. Se incluir, você não precisa criar um novo índice — peça ao Copilot para refinar a recomendação considerando o índice existente.

> [!NOTE]
> Você já capturou um baseline — logical reads, elapsed time e o table scan no plano de execução — quando confirmou que a procedure estava lenta. Mantenha esses valores disponíveis para compará-los após a criação do índice.

---

## Aplicar e verificar

1. Crie o índice sugerido pelo Copilot:

    ```sql
    CREATE NONCLUSTERED INDEX IX_WorkOrders_TechnicianID_Status
    ON dbo.WorkOrders (TechnicianID, Status)
    INCLUDE (WorkOrderID, OpenedDate, Description);
    ```

1. Execute novamente a stored procedure com `SET STATISTICS IO ON; SET STATISTICS TIME ON;` e compare os novos logical reads e elapsed time com o baseline capturado anteriormente. Confirme que os logical reads caíram significativamente e que o elapsed time caiu para menos de um segundo.

1. Inspecione novamente o plano de execução real. Confirme que agora existe um **Index Seek** em `IX_WorkOrders_TechnicianID_Status` no lugar do table scan.

1. Em um ambiente real, valide primeiro a alteração fora de produção e depois agende a criação do índice em produção durante uma janela de manutenção.

---

## Resultado esperado

Um índice nonclustered direcionado elimina o table scan em `WorkOrders`, e a stored procedure passa a retornar em menos de um segundo, em vez de levar vários segundos. Você seguiu todo o validation gate: confirmou a consulta lenta e capturou um baseline, verificou a existência de índices redundantes, aplicou o índice recomendado pelo Copilot e validou a melhoria com estatísticas e com o plano de execução.

> [!IMPORTANT]
> A própria criação do índice causa um bloqueio breve da tabela nas edições padrão. Para tabelas grandes em produção, use a opção `ONLINE = ON` se o seu service tier oferecer suporte e agende a operação para horários de menor tráfego.
