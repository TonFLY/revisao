# Criar um alerta de status de CPU para um SQL Server no Azure

**Tempo estimado: 20 minutos**

Você foi contratado como Engenheiro de Dados Sênior para ajudar a automatizar as operações diárias de administração de bancos de dados. Essa automação deve ajudar a garantir que os bancos da AdventureWorks continuem operando com alto desempenho e também fornecer mecanismos de alerta com base em determinados critérios.

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

    > &#128221; Por padrão, esse script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, os recursos também serão criados na região **West US 2** (westus2). O script gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando os parâmetros **-rgName**, **-location** e **-sqlAdminPw**. A senha deve atender aos requisitos de complexidade do Azure SQL: pelo menos 12 caracteres, incluindo ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. *Anote esses valores, pois eles serão necessários mais tarde no laboratório.*

---

## Criar um alerta quando a CPU ultrapassar uma média de 80 por cento

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, na barra de pesquisa na parte superior, digite **SQL databases** e selecione **SQL databases**. Selecione o banco **AdventureWorksLT** listado.

1. No painel principal do banco **AdventureWorksLT**, navegue até a seção de monitoramento. Selecione **Alerts**.

1. Selecione **Create alert rule**.

1. Na página **Create an alert rule**, selecione **CPU percentage**.

1. Na seção **Alert logic**, selecione **Static** em **Threshold type**. Confirme que **Aggregation** está definido como **Average** e que **Value is** está definido como **Greater than**. Em **Threshold**, informe **80**. Revise também os valores de *Check every* e *lookback period*.

1. Selecione **Next: Actions >**.

1. Na guia **Actions**, selecione **Create action group**.

1. Na tela **Action Group**, digite **emailgroup** nos campos **Action group name** e **Display name** e selecione **Next: Notifications**.

1. Na guia **Notifications**, informe os seguintes dados:

    - **Notification type:** Email/SMS message/Push/Voice

        > &#128221; Ao selecionar essa opção, será aberto um painel Email/SMS message/Push/Voice. Marque a propriedade Email e informe o nome de usuário do Azure com o qual você entrou. Selecione **OK**.

    - **Name:** DemoLab

1. Selecione **Review + create** e depois **Create**.

1. De volta à página **Create an alert rule**, selecione **Next: Details** e dê um nome exclusivo à regra de alerta.

1. Selecione **Review + create** e depois **Create**.

1. Com o alerta configurado, se a utilização média de CPU ultrapassar 80%, um e-mail será enviado.

---

## Limpar os recursos

Se você não for usar o Azure SQL Server para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos criado para este laboratório. Ele conterá o Azure SQL Server e os outros recursos criados durante o lab.

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

---

Você concluiu este laboratório com sucesso.

Alertas podem enviar um e-mail ou chamar um webhook quando alguma métrica — por exemplo, tamanho do banco ou uso de CPU — atinge um limite definido por você. Neste laboratório, você viu como configurar facilmente alertas para Azure SQL Databases.
