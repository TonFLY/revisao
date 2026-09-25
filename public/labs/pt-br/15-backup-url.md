# Backup para URL

**Tempo estimado: 30 minutos**

Como DBA da AdventureWorks, você precisa fazer backup de um banco de dados para uma URL no Azure e restaurá-lo a partir do Azure Blob Storage depois que ocorrer um erro humano.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P), digite **Git: Clone** e selecione **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, criando a pasta se necessário.

## Restaurar o banco de dados

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

## Configurar Backup to URL

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra o repositório clonado em **C:\LabFiles\dp-300-database-administrator**.

1. Clique com o botão direito na pasta **Allfiles** e selecione **Open in Integrated Terminal**. Isso abrirá uma janela de terminal no local correto.

1. No terminal, digite o comando abaixo e pressione **Enter**.

    ```bash
    az login
    ```

1. Você será solicitado a abrir um navegador e inserir um código. Siga as instruções para entrar na sua conta do Azure.

1. *Pule esta etapa se você já tiver um resource group.* Caso contrário, crie um executando o comando abaixo no terminal. Substitua *contoso-rgXXX######* por um nome exclusivo para seu resource group. O nome deve ser exclusivo no Azure. Substitua também a localização (-l) pela região do seu resource group.

    ```bash
    az group create -n "contoso-rglod#######" -l eastus2
    ```

    Substitua **######** por alguns caracteres aleatórios.

1. No terminal, digite o comando abaixo e pressione **Enter** para criar uma storage account. Use um nome exclusivo. *O nome deve ter entre 3 e 24 caracteres e pode conter apenas números e letras minúsculas.* Substitua *########* por 8 caracteres numéricos aleatórios. O nome deve ser exclusivo no Azure. Substitua contoso-rgXXX###### pelo nome do seu resource group e altere a localização (-l) para a região do resource group.

    ```bash
    az storage account create -n "dp300bckupstrg########" -g "contoso-rgXXX########" --kind StorageV2 -l eastus2
    ```

1. Em seguida, obtenha as chaves da storage account, que serão usadas nas etapas posteriores. Execute o código abaixo no terminal usando o nome exclusivo da storage account e do resource group.

    ```bash
    az storage account keys list -g contoso-rgXXX######## -n dp300bckupstrg########
    ```

    A chave da conta aparecerá nos resultados. Confirme que você está usando o mesmo nome — após **-n** — e o mesmo resource group — após **-g** — usados no comando anterior. Copie o valor retornado para **key1**, sem as aspas duplas.

1. Fazer backup de um banco SQL Server para uma URL usa um container dentro de uma storage account. Nesta etapa, você criará um container específico para armazenar backups. Execute o comando abaixo.

    ```bash
    az storage container create --name "backups" --account-name "dp300bckupstrg########" --account-key "storage_key" --fail-on-exist
    ```

    Onde **dp300bckupstrg########** é o nome exclusivo usado na criação da storage account e **storage_key** é a chave gerada anteriormente. A saída deverá retornar **true**.

1. Para confirmar se o container backups foi criado corretamente, execute:

    ```bash
    az storage container list --account-name "dp300bckupstrg########" --account-key "storage_key"
    ```

    Onde **dp300bckupstrg########** é o nome exclusivo da storage account e **storage_key** é a chave gerada.

1. Por segurança, é necessária uma shared access signature (SAS) no nível do container. Execute o comando abaixo no terminal:

    ```bash
    az storage container generate-sas -n "backups" --account-name "dp300bckupstrg########" --account-key "storage_key" --permissions "rwdl" --expiry "date_in_the_future" -o tsv
    ```

    Onde **dp300bckupstrg########** é o nome exclusivo da storage account, **storage_key** é a chave gerada e **date_in_the_future** é uma data/hora futura. **date_in_the_future** deve estar em UTC. Um exemplo é **2025-12-31T00:00Z**, que corresponde a expiração em 31 de dezembro de 2025 à meia-noite.

    A saída deverá ser semelhante à seguinte. Copie toda a shared access signature e cole-a no **Notepad**. Ela será usada na próxima tarefa.

    *se=2020-12-31T00%3A00Z&sp=rwdl&sv=2018-11-09&sr=c&sig=rnoGlveGql7ILhziyKYUPBq5ltGc/pzqOCNX5rrLdRQ%3D*

## Criar a credential

Agora que a funcionalidade está configurada, você pode gerar um arquivo de backup como blob na Azure Storage Account.

1. Inicie o **SQL Server Management Studio (SSMS)**.

1. Você será solicitado a conectar ao SQL Server. Confirme que **Windows Authentication** está selecionado e selecione **Connect**.

1. Selecione **New Query**.

1. Crie a credential que será usada para acessar o armazenamento na nuvem com o Transact-SQL abaixo. Preencha os valores apropriados e selecione **Execute**.

    ```sql
    IF NOT EXISTS  
    (SELECT * 
        FROM sys.credentials  
        WHERE name = 'https://<storage_account_name>.blob.core.windows.net/backups')  
    BEGIN
        CREATE CREDENTIAL [https://<storage_account_name>.blob.core.windows.net/backups]
        WITH IDENTITY = 'SHARED ACCESS SIGNATURE',
        SECRET = '<key_value>'
    END;
    GO  
    ```

    Nas duas ocorrências, **<storage_account_name>** representa o nome exclusivo da storage account criada, e **<key_value>** é o valor gerado ao final da tarefa anterior, semelhante ao seguinte:

    *se=2020-12-31T00%3A00Z&sp=rwdl&sv=2018-11-09&sr=c&sig=rnoGlveGql7ILhziyKYUPBq5ltGc/pzqOCNX5rrLdRQ%3D*

1. Você pode verificar se a credential foi criada com sucesso navegando até **Security -> Credentials** no Object Explorer do SSMS.

1. Se você digitou algo incorretamente e precisa recriar a credential, poderá removê-la com o comando abaixo. Altere o nome da storage account conforme necessário:

    ```sql
    -- Only run this command if you need to go back and recreate the credential! 
    DROP CREDENTIAL [https://<storage_account_name>.blob.core.windows.net/backups]  
    ```

## Fazer backup do banco para URL

1. Usando o SSMS, faça backup do banco **AdventureWorks2017** no Azure usando o seguinte comando Transact-SQL:

    ```sql
    BACKUP DATABASE AdventureWorks2017   
    TO URL = 'https://<storage_account_name>.blob.core.windows.net/backups/AdventureWorks2017.bak';
    GO 
    ```

    Onde **<storage_account_name>** é o nome exclusivo da storage account criada.

    Se ocorrer um erro, confirme que nada foi digitado incorretamente durante a criação da credential e que todos os recursos foram criados com sucesso.

## Validar o backup pelo Azure CLI

Para confirmar que o arquivo realmente está no Azure, você pode usar o Storage Explorer (preview) ou o Azure Cloud Shell.

1. De volta ao terminal do Visual Studio Code, execute este comando do Azure CLI:

    ```bash
    az storage blob list -c "backups" --account-name "dp300bckupstrg########" --account-key "storage_key" --output table
    ```

    Confirme que está usando o mesmo nome exclusivo da storage account — após **--account-name** — e a mesma account key — após **--account-key** — usados nos comandos anteriores.

    Assim, podemos confirmar que o arquivo de backup foi gerado com sucesso.

## Validar o backup pelo Storage Browser

1. Em uma janela do navegador, acesse o Azure portal, pesquise e selecione **Storage accounts**.

1. Selecione o nome exclusivo da storage account criada para os backups.

1. No painel de navegação esquerdo, selecione **Storage browser**. Expanda **Blob containers**.

1. Selecione **backups**.

1. Observe que o arquivo de backup está armazenado no container.

## Restaurar a partir de URL

Nesta tarefa, você verá como restaurar um banco de dados a partir do Azure Blob Storage.

1. No **SQL Server Management Studio (SSMS)**, selecione **New Query**, cole a consulta abaixo e execute-a.

    ```sql
    USE AdventureWorks2017;
    GO
    SELECT * FROM Person.Address WHERE AddressId = 1;
    GO
    ```

1. Execute o comando abaixo para alterar o endereço desse cliente.

    ```sql
    UPDATE Person.Address
    SET AddressLine1 = 'This is a human error'
    WHERE AddressId = 1;
    GO
    ```

1. Execute novamente a **Etapa 1** para confirmar que o endereço foi alterado. Agora imagine que alguém tivesse alterado milhares ou milhões de linhas sem cláusula WHERE — ou usando uma cláusula WHERE incorreta. Uma das soluções é restaurar o banco a partir do último backup disponível.

1. Para restaurar o banco ao estado anterior à alteração incorreta do endereço do cliente, execute o seguinte.

    > &#128221; Com a sintaxe **SET SINGLE_USER WITH ROLLBACK IMMEDIATE**, todas as transações abertas serão revertidas. Isso pode impedir que o restore falhe por causa de conexões ativas.

    ```sql
    USE [master]
    GO

    ALTER DATABASE AdventureWorks2017 SET SINGLE_USER WITH ROLLBACK IMMEDIATE
    GO

    RESTORE DATABASE AdventureWorks2017 
    FROM URL = 'https://<storage_account_name>.blob.core.windows.net/backups/AdventureWorks2017.bak'
    GO

    ALTER DATABASE AdventureWorks2017 SET MULTI_USER
    GO
    ```

    Onde **<storage_account_name>** é o nome exclusivo da storage account criada.

1. Execute novamente a **Etapa 1** para confirmar que o endereço do cliente foi restaurado.

É importante entender os componentes e como eles interagem para fazer backup para ou restore a partir do serviço Azure Blob Storage.

---

## Limpar os recursos

Se você não for usar os recursos do Azure para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos criado para este laboratório. Ele conterá os recursos criados durante o lab.

1. Selecione **Delete resource group** no menu superior.

1. Na caixa de diálogo **Delete resource group**, digite o nome do grupo de recursos para confirmar e selecione **Delete**.

1. Aguarde a exclusão do grupo de recursos.

1. Feche o Azure portal.

### Excluir somente os recursos do laboratório

Se você não criou um novo grupo de recursos para este laboratório e deseja manter o grupo e seus recursos anteriores, ainda poderá excluir somente os recursos criados neste lab.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos usado neste laboratório.

1. Selecione os recursos criados para este laboratório.

1. Selecione **Delete** no menu superior.

1. Na caixa de diálogo **Delete resources**, digite **delete** e selecione **Delete**.

1. Selecione **Delete** novamente para confirmar a exclusão dos recursos.

1. Aguarde a exclusão dos recursos.

1. Feche o Azure portal.

Se você não for usar o banco de dados nem os arquivos do laboratório para nenhuma outra finalidade, poderá remover os objetos criados neste lab.

### Excluir a pasta C:\LabFiles

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o **File Explorer**.
1. Navegue até **C:\**.
1. Exclua a pasta **C:\LabFiles**.

## Excluir o banco AdventureWorks2017

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do SQL Server Management Studio (SSMS).
1. Quando o SSMS abrir, a caixa de diálogo **Connect to Server** aparecerá por padrão. Escolha a instância Default e selecione **Connect**. Talvez seja necessário marcar **Trust server certificate**.
1. No **Object Explorer**, expanda a pasta **Databases**.
1. Clique com o botão direito no banco **AdventureWorks2017** e selecione **Delete**.
1. Na caixa de diálogo **Delete Object**, marque **Close existing connections**.
1. Selecione **OK**.

---

Você concluiu este laboratório com sucesso.

Agora você viu que é possível fazer backup de um banco para uma URL no Azure e, se necessário, restaurá-lo.
