# Identificar e resolver problemas de blocking

**Tempo estimado: 15 minutos**

Os alunos usarão as informações aprendidas nas aulas para definir os entregáveis de um projeto de transformação digital na AdventureWorks. Examinando o Azure portal e outras ferramentas, determinarão como usar ferramentas nativas para identificar e resolver problemas relacionados a desempenho. Ao final, serão capazes de identificar e resolver problemas de blocking de forma apropriada.

Você foi contratado como administrador de banco de dados para identificar problemas de desempenho e fornecer soluções viáveis para os problemas encontrados. Você precisa investigar os problemas de performance e sugerir formas de resolvê-los.

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

## Executar o relatório de consultas bloqueadas

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute** para executar a consulta.

    ```sql
    USE MASTER

    GO

    CREATE EVENT SESSION [Blocking] ON SERVER 
    ADD EVENT sqlserver.blocked_process_report(
    ACTION(sqlserver.client_app_name,sqlserver.client_hostname,sqlserver.database_id,sqlserver.database_name,sqlserver.nt_username,sqlserver.session_id,sqlserver.sql_text,sqlserver.username))
    ADD TARGET package0.ring_buffer
    WITH (MAX_MEMORY=4096 KB, EVENT_RETENTION_MODE=ALLOW_SINGLE_EVENT_LOSS, MAX_DISPATCH_LATENCY=30 SECONDS, MAX_EVENT_SIZE=0 KB,MEMORY_PARTITION_MODE=NONE, TRACK_CAUSALITY=OFF,STARTUP_STATE=ON)

    GO

    -- Start the event session 
    ALTER EVENT SESSION [Blocking] ON SERVER 
    STATE = start;

    GO
    ```

    O código T-SQL acima criará uma sessão de Extended Events que capturará eventos de blocking. Os dados conterão os seguintes elementos:

    - Nome da aplicação cliente
    - Nome do host cliente
    - ID do banco de dados
    - Nome do banco de dados
    - Nome de usuário NT
    - Session ID
    - Texto T-SQL
    - Nome de usuário

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute**.

    ```sql
    EXEC sys.sp_configure N'show advanced options', 1

    RECONFIGURE WITH OVERRIDE;

    GO
    EXEC sp_configure 'blocked process threshold (s)', 60

    RECONFIGURE WITH OVERRIDE;

    GO
    ```

    > &#128221; O comando acima define, em segundos, o limite a partir do qual os relatórios de processo bloqueado são gerados. Como resultado, não será necessário esperar tanto tempo para que o evento *blocked_process_report* seja disparado neste laboratório.

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute**.

    ```sql
    USE AdventureWorks2017

    GO

    BEGIN TRANSACTION
        UPDATE Person.Person 
        SET LastName = LastName;

    GO
    ```

1. Abra outra janela de consulta selecionando **New Query**. Copie e cole o T-SQL abaixo e selecione **Execute**.

    ```sql
    USE AdventureWorks2017

    GO

    SELECT TOP (1000) [LastName]
      ,[FirstName]
      ,[Title]
    FROM Person.Person
    WHERE FirstName = 'David'
    ```

    > &#128221; Observe que essa consulta não retorna resultados e parece executar indefinidamente.

1. No **Object Explorer**, expanda **Management** -> **Extended Events** -> **Sessions**.

    Observe que o extended event chamado *Blocking*, criado anteriormente, aparece na lista.

1. Expanda o extended event *Blocking*, clique com o botão direito em **package0.ring_buffer** e selecione **View Target Data**.

1. Selecione o hyperlink exibido.

1. O XML mostrará quais processos estão bloqueados e qual processo está causando o blocking. Você poderá ver as consultas executadas nesse processo e informações do sistema. Anote os session IDs (SPIDs).

1. Como alternativa, você pode executar a consulta abaixo para identificar sessões que estão bloqueando outras sessões, incluindo uma lista de session IDs bloqueados por *session_id*. Abra uma janela **New Query**, copie e cole o T-SQL abaixo e selecione **Execute**.

    ```sql
    WITH cteBL (session_id, blocking_these) AS 
    (SELECT s.session_id, blocking_these = x.blocking_these FROM sys.dm_exec_sessions s 
    CROSS APPLY    (SELECT isnull(convert(varchar(6), er.session_id),'') + ', '  
                    FROM sys.dm_exec_requests as er
                    WHERE er.blocking_session_id = isnull(s.session_id ,0)
                    AND er.blocking_session_id <> 0
                    FOR XML PATH('') ) AS x (blocking_these)
    )
    SELECT s.session_id, blocked_by = r.blocking_session_id, bl.blocking_these
    , batch_text = t.text, input_buffer = ib.event_info, * 
    FROM sys.dm_exec_sessions s 
    LEFT OUTER JOIN sys.dm_exec_requests r on r.session_id = s.session_id
    INNER JOIN cteBL as bl on s.session_id = bl.session_id
    OUTER APPLY sys.dm_exec_sql_text (r.sql_handle) t
    OUTER APPLY sys.dm_exec_input_buffer(s.session_id, NULL) AS ib
    WHERE blocking_these is not null or r.blocking_session_id > 0
    ORDER BY len(bl.blocking_these) desc, r.blocking_session_id desc, r.session_id;
    ```

    > &#128221; A consulta acima retornará os mesmos SPIDs encontrados no XML.

1. Clique com o botão direito no extended event chamado **Blocking** e selecione **Stop Session**.

1. Volte à sessão de consulta que está causando o blocking e digite `ROLLBACK TRANSACTION` na linha abaixo da consulta. Selecione `ROLLBACK TRANSACTION` e depois **Execute**.

1. Volte à sessão da consulta que estava bloqueada. Observe que agora a consulta foi concluída.

## Habilitar o nível de isolamento Read Committed Snapshot

1. Selecione **New Query** no SQL Server Management Studio. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute**.

    ```sql
    USE master

    GO
    
    ALTER DATABASE AdventureWorks2017 SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;

    GO
    ```

1. Execute novamente, em um novo editor de consulta, a query que causava o blocking. *Não execute o comando ROLLBACK TRANSACTION.*

    ```sql
    USE AdventureWorks2017
    GO
    
    BEGIN TRANSACTION
        UPDATE Person.Person 
        SET LastName = LastName;
    GO
    ```

1. Execute novamente, em outro editor de consulta, a query que estava sendo bloqueada.

    ```sql
    USE AdventureWorks2017
    GO
    
    SELECT TOP (1000) [LastName]
     ,[FirstName]
     ,[Title]
    FROM Person.Person
    WHERE firstname = 'David'
    ```

    Por que a mesma consulta é concluída agora, enquanto na tarefa anterior ela era bloqueada pela instrução UPDATE?

    O nível de isolamento Read Committed Snapshot é uma forma otimista de isolamento de transação. A última consulta exibirá a versão confirmada mais recente dos dados, em vez de ser bloqueada.

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

Neste exercício, você aprendeu a identificar sessões que estão sendo bloqueadas e a mitigar esses cenários.
