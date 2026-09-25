# Implantar um runbook de automação para reconstruir índices automaticamente

**Tempo estimado: 30 minutos**

Você foi contratado como Administrador Sênior de Banco de Dados para ajudar a automatizar as operações diárias de administração de bancos de dados. Essa automação deve ajudar a garantir que os bancos da AdventureWorks continuem operando com alto desempenho e também fornecer mecanismos de alerta com base em determinados critérios. A AdventureWorks usa SQL Server tanto em ofertas de Infrastructure as a Service (IaaS) quanto de Platform as a Service (PaaS).

> &#128221; Estes exercícios podem pedir que você copie e cole código T-SQL e usam recursos SQL já existentes. Antes de executar o código, confirme que ele foi copiado corretamente.

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

    > &#128221; Por padrão, esse script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, os recursos também serão criados na região **West US 2** (westus2). O script gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando os parâmetros **-rgName**, **-location** e **-sqlAdminPw**. A senha deve atender aos requisitos de complexidade do Azure SQL: pelo menos 12 caracteres, incluindo ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. *Anote esses valores, pois eles serão necessários mais tarde no laboratório.*

---

## Criar uma Automation Account

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, na barra de pesquisa, digite *automation*, selecione **Automation Accounts** nos resultados e depois selecione **+ Create**.

1. Na página **Create an Automation Account**, informe os dados abaixo e selecione **Review + Create**.

    - **Resource Group:** &lt;Seu grupo de recursos&gt;
    - **Automation account name:** autoAccount
    - **Region:** use o valor padrão.

1. Na página de revisão, selecione **Create**.

    > &#128221; A criação da Automation Account pode levar alguns minutos.

## Conectar a um Azure SQL Database existente

1. No Azure portal, navegue até seu banco pesquisando **sql databases**.

1. Selecione o SQL database **AdventureWorksLT**.

1. Na seção principal da página do SQL Database, selecione **Query editor (preview)**.

1. Serão solicitadas as credenciais da conta de administrador do banco. Entre e selecione **OK**.

    Isso abrirá uma nova guia no navegador. Selecione **Add client IP** e depois **Save**. Quando salvar, volte à guia anterior e selecione **OK** novamente.

    > &#128221; Você pode receber a mensagem *Cannot open server 'your-sql-server-name' requested by the login. Client with IP address 'xxx.xxx.xxx.xxx' is not allowed to access the server.* Nesse caso, será necessário adicionar seu IP público atual às regras de firewall do SQL server.

    Se precisar configurar as regras de firewall, siga estas etapas:

    1. Selecione **Set server firewall** na barra de menu superior da página **Overview** do banco.
    1. Selecione **Add your current IPv4 address (xxx.xxx.xxx.xxx)** e depois **Save**.
    1. Quando salvar, volte à página do banco **AdventureWorksLT** e selecione **Query editor (preview)** novamente.
    1. Entre usando a conta de administrador do banco e selecione **OK**.

1. Em **Query editor (preview)**, selecione **Open query**.

1. Selecione o ícone de *pasta* e navegue até **C:\LabFiles\dp-300-database-administrator\Allfiles\Labs\Module13**. Selecione o arquivo **usp_AdaptiveIndexDefrag.sql**, selecione **Open** e depois **OK**.

1. Exclua **USE msdb** e **GO** das linhas 5 e 6 da consulta e selecione **Run**.

1. Expanda a pasta **Stored Procedures** para ver as stored procedures recém-criadas.

## Configurar assets da Automation Account

As próximas etapas consistem em configurar os assets necessários antes da criação do runbook. Depois, selecione **Automation Accounts**.

1. No Azure portal, na caixa de pesquisa superior, digite **automation** e selecione **Automation Accounts**.

1. Selecione a Automation Account **autoAccount** que você criou.

1. Selecione **Modules** na seção **Shared Resources** do painel Automation. Depois selecione **Browse gallery**.

1. Pesquise **SqlServer** na Gallery.

1. Selecione **SqlServer**, que abrirá a tela seguinte, e depois selecione **Select**.

1. Na página **Add a module**, selecione a versão mais recente de runtime disponível e depois **Import**. Isso importará o módulo PowerShell para a Automation Account.

1. Você precisará criar uma credential para entrar de forma segura no banco. No painel da *Automation Account*, navegue até **Shared Resources** e selecione **Credentials**.

1. Selecione **+ Add a Credential**, informe os dados abaixo e selecione **Create**.

    - Name: **SQLUser**
    - User name: **sqladmin**
    - Password: &lt;Informe uma senha forte, com 12 caracteres, contendo pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.&gt;
    - Confirm password: &lt;Informe novamente a senha digitada anteriormente.&gt;

## Criar um runbook PowerShell

1. No Azure portal, navegue até seu banco pesquisando **sql databases**.

1. Selecione o SQL database **AdventureWorksLT**.

1. Na página **Overview**, copie o **Server name** do Azure SQL Database. O nome deverá começar com *dp300-lab*. Você o usará em etapas posteriores.

1. No Azure portal, na caixa de pesquisa superior, digite **automation** e selecione **Automation Accounts**.

1. Selecione a Automation Account **autoAccount**.

1. Expanda a seção **Process Automation** do painel da Automation Account e selecione **Runbooks**.

1. Selecione **+ Create a runbook**.

    > &#128221; Como vimos, existem dois runbooks já criados. Eles foram criados automaticamente durante o deployment da Automation Account.

1. Informe **IndexMaintenance** como nome do runbook e **PowerShell** como tipo. Selecione a versão mais recente de runtime disponível e depois **Review + Create**.

1. Na página **Create runbook**, selecione **Create**.

1. Depois que o runbook for criado, copie e cole o código PowerShell abaixo no editor do runbook.

    > &#128221; Antes de salvar o runbook, confirme que o código foi copiado corretamente.

    ```powershell
    $AzureSQLServerName = ''
    $DatabaseName = 'AdventureWorksLT'
    
    $Cred = Get-AutomationPSCredential -Name "SQLUser"
    $SQLOutput = $(Invoke-Sqlcmd -ServerInstance $AzureSQLServerName -UserName $Cred.UserName -Password $Cred.GetNetworkCredential().Password -Database $DatabaseName -Query "EXEC dbo.usp_AdaptiveIndexDefrag" -Verbose) 4>&1

    Write-Output $SQLOutput
    ```

    > &#128221; O código acima é um script PowerShell que executará a stored procedure **usp_AdaptiveIndexDefrag** no banco **AdventureWorksLT**. O script usa o cmdlet **Invoke-Sqlcmd** para conectar ao SQL server e executar a stored procedure. O cmdlet **Get-AutomationPSCredential** é usado para recuperar as credenciais armazenadas na Automation Account.

1. Na primeira linha do script, cole o nome do servidor copiado nas etapas anteriores.

1. Selecione **Save** e depois **Publish**.

1. Selecione **Yes** para confirmar a publicação.

1. O runbook *IndexMaintenance* agora está publicado.

## Criar um agendamento para o runbook

Em seguida, você agendará o runbook para execução periódica.

1. Em **Resources**, na navegação esquerda do runbook **IndexMaintenance**, selecione **Schedules**.

1. Selecione **+ Add a schedule**.

1. Selecione **Link a schedule to your runbook**.

1. Selecione **+ Add a schedule**.

1. Informe os dados abaixo e selecione **Create**.

    - **Name:** DailyIndexDefrag
    - **Description:** Daily Index defrag for AdventureWorksLT database.
    - **Starts:** 4:00 AM (dia seguinte)
    - **Time zone:** &lt;Selecione o fuso horário correspondente à sua localização&gt;
    - **Recurrence:** Recurring
    - **Recur every:** 1 day
    - **Set expiration:** No

    > &#128221; O horário inicial é definido como 4:00 AM do dia seguinte. O fuso horário deve ser o seu fuso local. A recorrência é definida para cada 1 dia e não expira.

1. Selecione **Create** e depois **OK**.

1. O agendamento agora foi criado e vinculado ao runbook. Selecione **OK**.

O Azure Automation fornece um serviço de automação e configuração baseado em nuvem que oferece gerenciamento consistente em ambientes Azure e não Azure.

---

## Limpar os recursos

Se você não for usar o Azure SQL Server para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos criado para este laboratório. Ele conterá o Azure SQL Server e os demais recursos criados durante o lab.

1. Selecione **Delete resource group** no menu superior.

1. Na caixa de diálogo **Delete resource group**, digite o nome do grupo de recursos para confirmar e selecione **Delete**.

1. Aguarde a exclusão do grupo de recursos.

1. Feche o Azure portal.

### Excluir somente os recursos do laboratório

Se você não criou um novo grupo de recursos para este laboratório e deseja manter o grupo e seus recursos anteriores, ainda poderá excluir somente os recursos criados neste lab.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos usado neste laboratório. Ele conterá o Azure SQL Server e os outros recursos criados durante o lab.

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

Ao concluir este exercício, você automatizou a desfragmentação de índices em um banco de dados SQL Server para executar todos os dias às 4:00 AM.
