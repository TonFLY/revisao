# Detectar e corrigir problemas de fragmentação

**Tempo estimado: 20 minutos**

Os alunos usarão as informações aprendidas nas aulas para definir os entregáveis de um projeto de transformação digital na AdventureWorks. Examinando o Azure portal e outras ferramentas, determinarão como usar ferramentas nativas para identificar e resolver problemas relacionados a desempenho. Ao final, serão capazes de identificar fragmentação no banco de dados e aprender as etapas apropriadas para corrigi-la.

Você foi contratado como administrador de banco de dados para identificar problemas de desempenho e fornecer soluções viáveis para os problemas encontrados. A AdventureWorks vende bicicletas e peças de bicicletas diretamente para consumidores e distribuidores há mais de uma década. Recentemente, a empresa percebeu degradação de desempenho nos produtos usados para atender solicitações de clientes. Você precisa usar ferramentas SQL para identificar os problemas de performance e sugerir formas de resolvê-los.

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

## Investigar fragmentação de índices

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute** para executar a consulta.

    ```sql
    USE AdventureWorks2017

    GO
    
    SELECT i.name Index_Name
     , avg_fragmentation_in_percent
     , db_name(database_id)
     , i.object_id
     , i.index_id
     , index_type_desc
    FROM sys.dm_db_index_physical_stats(db_id('AdventureWorks2017'),object_id('person.address'),NULL,NULL,'DETAILED') ps
     INNER JOIN sys.indexes i ON ps.object_id = i.object_id 
     AND ps.index_id = i.index_id
    WHERE avg_fragmentation_in_percent > 50 -- find indexes where fragmentation is greater than 50%
    ```

    Essa consulta exibirá os índices que tiverem fragmentação superior a **50%**. Neste momento, a consulta não deverá retornar resultados.

1. A fragmentação de índices pode ser causada por diversos fatores, incluindo:

    - Atualizações frequentes na tabela ou no índice.
    - Inserts ou deletes frequentes na tabela ou no índice.
    - Page splits.

    Para aumentar o nível de fragmentação da tabela Person.Address e de seus índices, você inserirá e excluirá uma grande quantidade de registros. Para isso, execute a consulta abaixo.

    Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute** para executá-lo.

    ```sql
    USE AdventureWorks2017

    GO
    
    -- Insert 60000 records into the Address table    

    INSERT INTO [Person].[Address] 
        ([AddressLine1], [AddressLine2], [City], [StateProvinceID], [PostalCode], [SpatialLocation], [rowguid], [ModifiedDate])
    SELECT 
        'Split Avenue ' + CAST(v1.number AS VARCHAR(10)), 
        'Apt ' + CAST(v2.number AS VARCHAR(10)), 
        'PageSplitTown', 
        100 + (v1.number % 60),  -- 60 different StateProvinceIDs (100-159)
        '88' + RIGHT('000' + CAST(v2.number AS VARCHAR(3)), 3), -- Structured postal codes
        NULL, 
        NEWID(), -- Ensure unique rowguid
        GETDATE()
    FROM master.dbo.spt_values v1
    CROSS JOIN master.dbo.spt_values v2
    WHERE v1.type = 'P' AND v1.number BETWEEN 1 AND 300 
    AND v2.type = 'P' AND v2.number BETWEEN 1 AND 200;
    GO
    
    -- DELETE 25000 records from the Address table
    DELETE FROM [Person].[Address] WHERE AddressID BETWEEN 35001 AND 60000;

    GO

    -- Insert 40000 records into the Address table
    INSERT INTO [Person].[Address] 
        ([AddressLine1], [AddressLine2], [City], [StateProvinceID], [PostalCode], [SpatialLocation], [rowguid], [ModifiedDate])
    SELECT 
        'Fragmented Street ' + CAST(v1.number AS VARCHAR(10)), 
        'Suite ' + CAST(v2.number AS VARCHAR(10)), 
        'FragmentCity', 
        100 + (v1.number % 60),  -- 60 different StateProvinceIDs (100-159)
        '99' + RIGHT('000' + CAST(v2.number AS VARCHAR(3)), 3), -- Structured postal codes
        NULL, 
        NEWID(), -- Ensure a unique rowguid per row
        GETDATE()
    FROM master.dbo.spt_values v1
    CROSS JOIN master.dbo.spt_values v2
    WHERE v1.type = 'P' AND v1.number BETWEEN 1 AND 200 
    AND v2.type = 'P' AND v2.number BETWEEN 1 AND 200;

    GO
    ```

    Essa consulta aumentará o nível de fragmentação da tabela Person.Address e de seus índices ao adicionar e excluir uma grande quantidade de registros.

1. Execute novamente a primeira consulta. Agora você deverá ver quatro índices com alto nível de fragmentação.

1. Selecione **New Query**, copie e cole o T-SQL abaixo na janela de consulta e selecione **Execute**.

    ```sql
    SET STATISTICS IO,TIME ON

    GO
        
    USE AdventureWorks2017

    GO
        
    SELECT DISTINCT (StateProvinceID)
        ,count(StateProvinceID) AS CustomerCount
    FROM person.Address
    GROUP BY StateProvinceID
    ORDER BY count(StateProvinceID) DESC;
        
    GO
    ```

    Selecione a guia **Messages** no painel de resultados do SQL Server Management Studio. Anote a quantidade de logical reads executados pela consulta na tabela **Address**.

## Reconstruir índices fragmentados

1. Selecione **New Query**, copie e cole o T-SQL abaixo na janela de consulta e selecione **Execute**.

    ```sql
    USE AdventureWorks2017

    GO
    
    ALTER INDEX [IX_Address_StateProvinceID] ON [Person].[Address] REBUILD PARTITION = ALL 
    WITH (PAD_INDEX = OFF, 
        STATISTICS_NORECOMPUTE = OFF, 
        SORT_IN_TEMPDB = OFF, 
        IGNORE_DUP_KEY = OFF, 
        ONLINE = OFF, 
        ALLOW_ROW_LOCKS = ON, 
        ALLOW_PAGE_LOCKS = ON)
    ```

1. Selecione **New Query** e execute a consulta abaixo para confirmar que o índice **IX_Address_StateProvinceID** não apresenta mais fragmentação superior a 50%.

    ```sql
    USE AdventureWorks2017

    GO
        
    SELECT DISTINCT i.name Index_Name
        , avg_fragmentation_in_percent
        , db_name(database_id)
        , i.object_id
        , i.index_id
        , index_type_desc
    FROM sys.dm_db_index_physical_stats(db_id('AdventureWorks2017'),object_id('person.address'),NULL,NULL,'DETAILED') ps
        INNER JOIN sys.indexes i ON (ps.object_id = i.object_id AND ps.index_id = i.index_id)
    WHERE i.name = 'IX_Address_StateProvinceID'
    ```

    Comparando os resultados, você poderá observar que a fragmentação de **IX_Address_StateProvinceID** caiu de aproximadamente 88% para 0%.

1. Execute novamente a instrução SELECT da seção anterior. Anote os logical reads na guia **Messages** do painel **Results** do Management Studio. *Houve alteração na quantidade de logical reads em relação ao valor observado antes de reconstruir o índice da tabela Address?*

    ```sql
    SET STATISTICS IO,TIME ON

    GO
        
    USE AdventureWorks2017

    GO
        
    SELECT DISTINCT (StateProvinceID)
        ,count(StateProvinceID) AS CustomerCount
    FROM person.Address
    GROUP BY StateProvinceID
    ORDER BY count(StateProvinceID) DESC;
        
    GO
    ```

Como o índice foi reconstruído, ele estará novamente organizado de forma mais eficiente e a quantidade de logical reads deverá diminuir. Agora você viu que a manutenção de índices pode afetar o desempenho de consultas.

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

Neste exercício, você aprendeu a reconstruir índices e analisar logical reads para melhorar o desempenho das consultas.
