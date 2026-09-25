# Isolar áreas problemáticas em consultas com baixo desempenho em um SQL Database

**Tempo estimado: 30 minutos**

Você foi contratado como Administrador Sênior de Banco de Dados para ajudar a resolver problemas de desempenho que estão ocorrendo quando os usuários consultam o banco *AdventureWorks2017*. Seu trabalho é identificar problemas de performance nas consultas e corrigi-los usando as técnicas aprendidas neste módulo.

Você executará consultas com desempenho subótimo, examinará os planos de execução e tentará fazer melhorias no banco de dados.

> &#128221; Estes exercícios pedem que você copie e cole código T-SQL. Antes de executar o código, confirme que ele foi copiado corretamente.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P), digite **Git: Clone** e selecione **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, criando a pasta se necessário.

---

## Restaurar um banco de dados

Se você já tiver o banco **AdventureWorks2017** restaurado, poderá pular esta seção.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do SQL Server Management Studio (SSMS).

1. Quando o SSMS abrir, a caixa de diálogo **Connect to Server** aparecerá por padrão. Escolha a instância Default e selecione **Connect**. Talvez seja necessário marcar **Trust server certificate**.

    > &#128221; Se você estiver usando sua própria instância do SQL Server, deverá conectar usando o nome de instância e as credenciais apropriadas.

1. Selecione a pasta **Databases** e depois **New Query**.

1. Na nova janela de consulta, copie e cole o T-SQL abaixo. Execute a consulta para restaurar o banco.

    ```sql
    RESTORE DATABASE AdventureWorks2017
    FROM DISK = 'C:\LabFiles\dp-300-database-administrator\Allfiles\Labs\Shared\AdventureWorks2017.bak'
    WITH RECOVERY,
          MOVE 'AdventureWorks2017' 
            TO 'C:\LabFiles\AdventureWorks2017.mdf',
          MOVE 'AdventureWorks2017_log'
            TO 'C:\LabFiles\AdventureWorks2017_log.ldf';
    ```

    > &#128221; É necessário existir uma pasta chamada **C:\LabFiles**. Se ela não existir, crie a pasta ou informe outro local para os arquivos do banco e do backup.

1. Na guia **Messages**, você deverá ver uma mensagem informando que o banco foi restaurado com sucesso.

## Gerar o plano de execução real

Existem várias formas de gerar um plano de execução no SQL Server Management Studio.

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute** para executar a consulta.

    **Observação:** use **SHOWPLAN_ALL** para ver uma versão textual do plano de execução de uma consulta no painel de resultados, em vez da representação gráfica em uma guia separada.

    ```sql
    USE AdventureWorks2017;

    GO

    SET SHOWPLAN_ALL ON;

    GO

    SELECT BusinessEntityID
    FROM HumanResources.Employee
    WHERE NationalIDNumber = '14417807';

    GO

    SET SHOWPLAN_ALL OFF;

    GO
    ```

    No painel de resultados, você verá uma versão textual do plano de execução em vez dos resultados reais da instrução **SELECT**.

1. Reserve um momento para examinar o texto da segunda linha da coluna **StmtText**:

    ```console
    |--Index Seek(OBJECT:([AdventureWorks2017].[HumanResources].[Employee].[AK_Employee_NationalIDNumber]), SEEK:([AdventureWorks2017].[HumanResources].[Employee].[NationalIDNumber]=CONVERT_IMPLICIT(nvarchar(4000),[@1],0)) ORDERED FORWARD)
    ```

    O texto acima explica que o plano usa um **Index Seek** na chave **AK_Employee_NationalIDNumber**. Também mostra que o plano precisou executar uma etapa **CONVERT_IMPLICIT**.

    O otimizador de consultas conseguiu localizar um índice adequado para buscar os registros necessários.

## Resolver um plano de consulta subótimo

1. Copie e cole o código abaixo em uma nova janela de consulta.

    Selecione o ícone **Include Actual Execution Plan** à direita do botão Execute ou pressione <kbd>CTRL</kbd>+<kbd>M</kbd>. Execute a consulta selecionando **Execute** ou pressionando <kbd>F5</kbd>. Anote o plano de execução e os logical reads na guia Messages.

    ```sql
    SET STATISTICS IO, TIME ON;

    SELECT [SalesOrderID] ,[CarrierTrackingNumber] ,[OrderQty] ,[ProductID], [UnitPrice] ,[ModifiedDate]
    FROM [AdventureWorks2017].[Sales].[SalesOrderDetail]
    WHERE [ModifiedDate] > '2012/01/01' AND [ProductID] = 772;
    ```

    Ao revisar o plano de execução, observe que existe um **Key Lookup**. Passe o mouse sobre o ícone e veja que as propriedades indicam que ele é executado para cada linha recuperada pela consulta. O plano está executando uma operação **Key Lookup**.

    Anote as colunas da seção **Output List**. Como você melhoraria essa consulta?

    Para identificar qual índice precisa ser alterado para remover o Key Lookup, examine o index seek acima dele. Passe o mouse sobre o operador index seek para ver suas propriedades.

1. **Key Lookups** podem ser removidos adicionando um índice de cobertura que inclua todos os campos retornados ou pesquisados pela consulta. Neste exemplo, o índice usa apenas a coluna **ProductID**. A definição atual é mostrada abaixo. Observe que **ProductID** é a única coluna-chave, forçando um **Key Lookup** para recuperar as outras colunas necessárias.

    ```sql
    CREATE NONCLUSTERED INDEX [IX_SalesOrderDetail_ProductID] ON [Sales].[SalesOrderDetail]
    ([ProductID] ASC)
    ```

    Se adicionarmos os campos da **Output List** como included columns, o **Key Lookup** será removido. Como o índice já existe, é necessário removê-lo e recriá-lo ou usar **DROP_EXISTING=ON** para adicionar as colunas. Observe que **ProductID** já faz parte do índice e não precisa ser adicionada como included column. Também podemos melhorar o índice adicionando **ModifiedDate**. Abra uma janela **New Query** e execute o script abaixo para recriar o índice.

    ```sql
    CREATE NONCLUSTERED INDEX [IX_SalesOrderDetail_ProductID]
    ON [Sales].[SalesOrderDetail] ([ProductID],[ModifiedDate])
    INCLUDE ([CarrierTrackingNumber],[OrderQty],[UnitPrice])
    WITH (DROP_EXISTING = on);
    GO
    ```

1. Execute novamente a consulta da etapa 1. Anote as mudanças nos logical reads e no plano de execução. Agora o plano precisa usar apenas o índice nonclustered que você criou.

> &#128221; Ao revisar o plano de execução, observe que o **Key Lookup** desapareceu e agora somente o índice nonclustered é usado.

## Usar Query Store para detectar e tratar regressão

Em seguida, você executará um workload para gerar estatísticas de consultas no Query Store, examinará o relatório **Top Resource Consuming Queries** para identificar baixo desempenho e verá como forçar um plano de execução melhor.

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta e selecione **Execute**.

    Esse script habilita o Query Store no banco AdventureWorks2017 e define o Compatibility Level como 100.

    ```sql
    USE [master];

    GO

    ALTER DATABASE [AdventureWorks2017] SET QUERY_STORE = ON;

    GO

    ALTER DATABASE [AdventureWorks2017] SET QUERY_STORE (OPERATION_MODE = READ_WRITE);

    GO

    ALTER DATABASE [AdventureWorks2017] SET COMPATIBILITY_LEVEL = 100;

    GO
    ```

    Alterar o nível de compatibilidade é como mover o banco de dados de volta no tempo. Isso restringe os recursos que o SQL Server pode usar àqueles disponíveis no SQL Server 2008.

1. No SQL Server Management Studio, selecione **File** > **Open** > **File**.

1. Navegue até o arquivo **C:\LabFiles\dp-300-database-administrator\Allfiles\Labs\10\CreateRandomWorkloadGenerator.sql**.

1. Depois que o arquivo for aberto no SQL Server Management Studio, selecione **Execute**.

1. Em um novo editor de consulta, abra o arquivo **C:\LabFiles\dp-300-database-administrator\Allfiles\Labs\10\ExecuteRandomWorkload.sql** e selecione **Execute**.

1. Quando a execução terminar, execute o script uma segunda vez para criar carga adicional no servidor. Mantenha essa guia de consulta aberta.

1. Copie e cole o código abaixo em uma nova janela e execute-o selecionando **Execute**.

    Esse script altera o compatibility mode do banco para SQL Server 2022 (**160**). Todos os recursos e melhorias disponibilizados desde o SQL Server 2008 passarão a estar disponíveis para o banco.

    ```sql
    USE [master];

    GO

    ALTER DATABASE [AdventureWorks2017] SET COMPATIBILITY_LEVEL = 160;

    GO
    ```

1. Volte à guia de consulta aberta a partir do arquivo **ExecuteRandomWorkload.sql** e execute-a novamente.

## Examinar o relatório Top Resource Consuming Queries

1. Para visualizar o nó Query Store, atualize o banco AdventureWorks2017 no SQL Server Management Studio. Clique com o botão direito no nome do banco e selecione **Refresh**. Em seguida, o nó Query Store aparecerá abaixo do banco.

1. Expanda o nó **Query Store** para visualizar todos os relatórios disponíveis. Selecione **Top Resource Consuming Queries**.

1. Quando o relatório abrir, selecione o menu suspenso e depois **Configure** no canto superior direito do relatório.

1. Na tela de configuração, altere o filtro de número mínimo de query plans para 2. Depois selecione **OK**.

1. Escolha a consulta com maior duração selecionando a barra mais à esquerda no gráfico de barras localizado no canto superior esquerdo do relatório.

    Isso exibirá a consulta e o resumo de planos da consulta de maior duração no Query Store. Observe o gráfico *Plan summary* no canto superior direito e o *query plan* na parte inferior do relatório.

## Forçar um plano de execução melhor

1. Navegue até a área de resumo de planos do relatório. Observe que existem dois planos de execução com durações bastante diferentes.

1. Selecione o Plan ID com menor duração — indicado por uma posição mais baixa no eixo Y do gráfico — na janela superior direita. Selecione o plan ID ao lado do gráfico Plan Summary.

1. Selecione **Force Plan** abaixo do gráfico de resumo. Uma janela de confirmação será exibida; selecione **Yes**.

    Depois que o plano for forçado, você verá que **Force Plan** ficará desabilitado e o plano na janela de resumo apresentará uma marca de seleção indicando que está forçado.

    Em alguns momentos, o otimizador de consultas pode escolher um plano de execução ruim. Quando isso acontece, é possível forçar o SQL Server a usar o plano que você sabe que apresenta melhor desempenho.

## Usar query hints para influenciar o desempenho

Em seguida, você executará um workload, alterará a consulta para usar um parâmetro, aplicará um query hint e executará a consulta novamente.

Antes de continuar, feche todas as janelas de consulta abertas selecionando o menu **Window** e depois **Close All Documents**. Na janela pop-up, selecione **No**.

1. Selecione **New Query** e depois o ícone **Include Actual Execution Plan** antes de executar a consulta, ou use <kbd>CTRL</kbd>+<kbd>M</kbd>.

1. Execute a consulta abaixo. Observe que o plano de execução mostra um operador index seek.

    ```sql
    USE AdventureWorks2017;

    GO

    SELECT SalesOrderId, OrderDate
    FROM Sales.SalesOrderHeader
    WHERE SalesPersonID=288;
    ```

1. Em uma nova janela de consulta, execute a consulta abaixo. Compare os dois planos de execução.

    ```sql
    USE AdventureWorks2017;
    GO

    SELECT SalesOrderId, OrderDate
    FROM Sales.SalesOrderHeader
    WHERE SalesPersonID=277;
    ```

    Desta vez, a única alteração é que o valor de SalesPersonID foi definido como 277. Observe a operação Clustered Index Scan no plano de execução.

Como podemos ver, com base nas estatísticas do índice, o otimizador escolheu um plano diferente por causa dos diferentes valores usados na cláusula **WHERE**.

Por que temos planos diferentes se apenas alteramos o valor de *SalesPersonID*?

Essa consulta usa uma constante na cláusula **WHERE**. O otimizador considera cada uma dessas consultas única e gera um plano de execução diferente para cada uma.

## Alterar a consulta para usar uma variável e um Query Hint

1. Altere a consulta para usar um valor de variável para SalesPersonID.

1. Use a instrução T-SQL **DECLARE** para declarar <strong>@SalesPersonID</strong>, permitindo passar um valor em vez de deixá-lo fixo na cláusula **WHERE**. Confirme que o tipo de dados da variável corresponde ao tipo da coluna da tabela de destino para evitar conversão implícita. Execute a consulta com o plano de execução real habilitado.

    ```sql
    USE AdventureWorks2017;

    GO

    SET STATISTICS IO, TIME ON;

    DECLARE @SalesPersonID INT;

    SELECT @SalesPersonID = 288;

    SELECT SalesOrderId, OrderDate
    FROM Sales.SalesOrderHeader
    WHERE SalesPersonID= @SalesPersonID;
    ```

    Ao examinar o plano, observe que ele usa um index scan para obter os resultados. O otimizador não conseguiu fazer otimizações melhores porque não conhece o valor da variável local até o tempo de execução.

1. Você pode ajudar o otimizador a fazer uma escolha melhor fornecendo um query hint. Execute novamente a consulta anterior com **OPTION (RECOMPILE)**:

    ```sql
    USE AdventureWorks2017

    GO

    SET STATISTICS IO, TIME ON;

    DECLARE @SalesPersonID INT;

    SELECT @SalesPersonID = 288;

    SELECT SalesOrderId, OrderDate
    FROM Sales.SalesOrderHeader
    WHERE SalesPersonID= @SalesPersonID
    OPTION (RECOMPILE);
    ```

    Observe que o otimizador conseguiu escolher um plano de execução mais eficiente. A opção **RECOMPILE** faz com que o compilador da consulta substitua a variável pelo seu valor.

    Comparando as estatísticas, na guia Messages você verá que a diferença nos logical reads é de **68%** a mais (689 contra 409) para a consulta sem o query hint.

---

## Limpeza

Se você não for usar o banco de dados nem os arquivos do laboratório para nenhuma outra finalidade, poderá remover os objetos criados neste lab.

### Excluir a pasta C:\LabFiles

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o **File Explorer**.
1. Navegue até **C:\**.
1. Exclua a pasta **C:\LabFiles**.

### Excluir o banco AdventureWorks2017

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do SQL Server Management Studio (SSMS).
1. Quando o SSMS abrir, a caixa de diálogo **Connect to Server** aparecerá por padrão. Escolha a instância Default e selecione **Connect**. Talvez seja necessário marcar **Trust server certificate**.
1. No **Object Explorer**, expanda a pasta **Databases**.
1. Clique com o botão direito no banco **AdventureWorks2017** e selecione **Delete**.
1. Na caixa de diálogo **Delete Object**, marque **Close existing connections**.
1. Selecione **OK**.

---

Você concluiu este laboratório com sucesso.

Neste exercício, você aprendeu a identificar problemas de consulta e corrigi-los para melhorar o plano de execução.
