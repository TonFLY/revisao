# Isolar problemas de desempenho por meio de monitoramento

**Tempo estimado: 30 minutos**

Os alunos usarão as informações aprendidas nas aulas para definir os entregáveis de um projeto de transformação digital na AdventureWorksLT. Examinando o Azure portal e outras ferramentas, determinarão como usar os recursos disponíveis para identificar e resolver problemas relacionados a desempenho.

Você foi contratado como administrador de banco de dados para identificar problemas de desempenho e fornecer soluções viáveis para os problemas encontrados. Você precisa usar o Azure portal para identificar os problemas de performance e sugerir formas de resolvê-los.

> &#128221; Estes exercícios pedem que você copie e cole código T-SQL e usam recursos SQL já existentes. Antes de executar o código, confirme que ele foi copiado corretamente.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P), digite **Git: Clone** e selecione **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, criando a pasta se necessário.

## Configurar seu SQL Server no Azure

Entre no Azure e verifique se já existe uma instância de Azure SQL Server em execução. *Pule esta seção se você já tiver uma instância de SQL Server em execução no Azure.*

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie o Visual Studio Code e navegue até o repositório clonado na seção anterior.

1. Clique com o botão direito na pasta **/Allfiles/Labs** e selecione **Open in Integrated Terminal**.

1. Conecte ao Azure usando o Azure CLI. Digite o comando abaixo e pressione **Enter**.

    ```bash
    az login
    ```

    > &#128221; Uma janela do navegador será aberta. Use suas credenciais do Azure para entrar.

1. Depois de entrar no Azure, crie um resource group caso ele ainda não exista e crie um SQL server e um database nesse grupo. Digite o comando abaixo e pressione **Enter**. *O script levará alguns minutos para ser concluído.*

    ```bash
    cd ./Setup
    ./deploy-sql-database.ps1
    ```

    > &#128221; Por padrão, o script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, os recursos serão criados na região **West US 2** (westus2). O script também gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando os parâmetros **-rgName**, **-location** e **-sqlAdminPw**. A senha deve atender aos requisitos de complexidade do Azure SQL: pelo menos 12 caracteres, incluindo ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. *Anote esses valores, pois eles serão necessários mais tarde no laboratório.*

---

## Revisar a utilização de CPU no Azure portal

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, pesquise *SQL servers* na caixa de pesquisa na parte superior e selecione **SQL servers** na lista de opções.

1. Selecione o SQL server **dp300-lab-xxxxxxxx**, em que *xxxxxxxx* é uma sequência numérica aleatória.

    > &#128221; Se você estiver usando seu próprio Azure SQL server e ele não tiver sido criado por este laboratório, selecione o nome desse SQL server.

1. Na página principal do Azure SQL server, em **Security**, selecione **Networking**.

1. Na página **Networking**, verifique se seu IP público atual já está presente na lista **Firewall rules**. Se não estiver, selecione **+ Add your client IPv4 address (your IP address)** para adicioná-lo e depois selecione **Save**.

1. No painel principal do Azure SQL server, navegue até a seção **Settings**, selecione **SQL databases** e depois o banco **AdventureWorksLT**.

1. No painel de navegação esquerdo, selecione **Query editor (preview)**.

    **Observação:** esse recurso está em preview.

1. Selecione o nome do usuário administrador do SQL Server e informe a senha, ou use suas credenciais Microsoft Entra, se estiverem atribuídas, para conectar ao banco.
    - **Server name:** &lt;_cole aqui o nome do servidor do Azure SQL Database_&gt;
    - **Authentication:** SQL Server Authentication
    - **Server admin login:** seu login de administrador do Azure SQL Database server
    - **Password:** sua senha de administrador do Azure SQL Database server

1. Em **Query 1**, digite a consulta abaixo e selecione **Run**:

    ```sql
    DECLARE @Counter INT 
    SET @Counter=1
    WHILE ( @Counter <= 10000)
    BEGIN
        SELECT 
             RTRIM(a.Firstname) + ' ' + RTRIM(a.LastName)
            , b.AddressLine1
            , b.AddressLine2
            , RTRIM(b.City) + ', ' + RTRIM(b.StateProvince) + '  ' + RTRIM(b.PostalCode)
            , CountryRegion
            FROM SalesLT.Customer a
            INNER JOIN SalesLT.CustomerAddress c 
                ON a.CustomerID = c.CustomerID
            RIGHT OUTER JOIN SalesLT.Address b
                ON b.AddressID = c.AddressID
        ORDER BY a.LastName ASC
        SET @Counter  = @Counter  + 1
    END
    ```

1. Aguarde a conclusão da consulta.

1. Execute novamente a consulta mais *duas* vezes para gerar alguma carga de CPU no banco.

1. No painel do banco **AdventureWorksLT**, selecione o ícone **Metrics** na seção **Monitoring**.

    Se aparecer a mensagem *Your unsaved changes will be discarded*, selecione **OK**.

1. Altere a opção **Metric** para **CPU Percentage** e selecione **Avg** em **Aggregation**. Isso exibirá o percentual médio de CPU no período selecionado.

1. Observe a média de CPU ao longo do tempo. Você deverá perceber um pico de utilização de CPU no final do gráfico, correspondente ao período em que a consulta estava sendo executada.

## Identificar consultas com alto consumo de CPU

1. Localize o ícone **Query Performance Insight** na seção **Intelligent Performance** do painel do banco **AdventureWorksLT**.

1. Selecione **Reset settings**.

1. Selecione a consulta na grade abaixo do gráfico. Se a consulta executada várias vezes anteriormente não aparecer, aguarde de 2 a 5 minutos e selecione **Refresh**.

    > &#128221; Se houver mais de uma consulta listada, selecione cada uma para observar os resultados. Observe a quantidade de informações disponíveis para cada consulta.

1. Para a consulta executada anteriormente, observe que a duração total foi superior a um minuto e que ela foi executada aproximadamente trinta mil vezes.

1. Ao comparar o texto SQL da página **Query details** com a consulta executada, observe que **Query details** inclui somente a instrução **SELECT**, e não o loop **WHILE** nem outras instruções. Isso ocorre porque o **Query Performance Insight** usa dados do **Query Store**, que rastreia somente instruções de Data Manipulation Language (DML), como **SELECT, INSERT, UPDATE, DELETE, MERGE** e **BULK INSERT**, ignorando instruções de Data Definition Language (DDL).

Nem todos os problemas de desempenho estão relacionados a uma única execução de consulta com alto uso de CPU. Neste caso, a consulta foi executada milhares de vezes, o que também pode causar alta utilização de CPU.

---

## Limpar os recursos

Se você não for usar o Azure SQL Server para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos criado para este laboratório. Ele conterá o Azure SQL Server e outros recursos criados durante o lab.

1. Selecione **Delete resource group** no menu superior.

1. Na caixa de diálogo **Delete resource group**, digite o nome do grupo de recursos para confirmar e selecione **Delete**.

1. Aguarde a exclusão do grupo de recursos.

1. Feche o Azure portal.

### Excluir somente os recursos do laboratório

Se você não criou um novo grupo de recursos para este laboratório e deseja manter o grupo e seus recursos anteriores, ainda poderá excluir somente os recursos criados neste lab.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos usado neste laboratório. Ele conterá o Azure SQL Server e os demais recursos criados durante o lab.

1. Selecione todos os recursos cujo nome começa com o nome do SQL Server informado anteriormente no laboratório.

1. Selecione **Delete** no menu superior.

1. Na caixa de diálogo **Delete resources**, digite **delete** e selecione **Delete**.

1. Selecione **Delete** novamente para confirmar a exclusão dos recursos.

1. Aguarde a exclusão dos recursos.

1. Feche o Azure portal.

### Excluir a pasta LabFiles

Se você criou uma nova pasta LabFiles para este laboratório e não precisa mais dela, poderá excluí-la para remover todos os arquivos criados durante o lab.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o File Explorer e navegue até a unidade **C:\**.
1. Clique com o botão direito na pasta **LabFiles** e selecione **Delete**.
1. Selecione **Yes** para confirmar a exclusão da pasta.

---

Você concluiu este laboratório com sucesso.

Neste exercício, você aprendeu a explorar os recursos do servidor de um Azure SQL Database e a identificar possíveis problemas de desempenho de consultas usando o Query Performance Insight.
