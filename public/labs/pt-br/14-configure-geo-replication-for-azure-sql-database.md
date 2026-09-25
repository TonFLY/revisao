# Configurar geo-replicação para Azure SQL Database

**Tempo estimado: 30 minutos**

Como DBA da AdventureWorks, você precisa habilitar geo-replicação para Azure SQL Database e confirmar que ela está funcionando corretamente. Além disso, fará um failover manual para outra região usando o portal.

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

## Habilitar geo-replicação

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, navegue até seu banco pesquisando **sql databases**.

1. Selecione o SQL database **AdventureWorksLT**.

1. No painel do banco, na seção **Data management**, selecione **Replicas**.

1. Selecione **+ Create replica**.

1. Na página **Create SQL Database - Geo Replica**, observe que as seções **Project details** e **Primary database** já estão preenchidas com a assinatura, o resource group e o nome do banco.

1. Na seção **Replica Configuration**, selecione **Geo replica** em *Replica type*.

1. Em **Geo-secondary database details**, preencha os seguintes valores:

    - **Subscription:** &lt;Nome da sua assinatura&gt; — a mesma do banco primário.
    - **Resource group:** &lt;Selecione o mesmo resource group do banco primário.&gt;
    - **Database name:** o nome do banco estará desabilitado e será o mesmo do banco primário.
    - **Server:** selecione **Create new**.
    - Na página **Create SQL Database Server**, preencha os seguintes valores:

        - **Server name:** informe um nome exclusivo para o servidor secundário. O nome deve ser exclusivo entre todos os Azure SQL Database servers.
        - **Location:** selecione uma região diferente da região do banco primário. Sua assinatura pode não disponibilizar todas as regiões.
        - Marque **Allow Azure services to access server**. Em produção, você poderá querer restringir o acesso ao servidor.
        - Em authentication, selecione **SQL authentication**. Em produção, você poderá preferir **Use Microsoft Entra-only** authentication. Informe **sqladmin** como nome de login do administrador e uma senha segura. A senha deve atender aos requisitos de complexidade do Azure SQL: pelo menos 12 caracteres, contendo ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.
        - Selecione **OK** para criar o servidor.

    - **Want to use elastic pool?:** No.
    - **Compute + storage:** General Purpose, Gen 5, 2 vCores, 32 GB de armazenamento.
    - **Backup storage redundancy:** Locally redundant storage (LRS). Em produção, você poderá preferir **Geo-redundant storage (GRS)**.

1. Selecione **Review + Create**.

1. Selecione **Create**. A criação do servidor secundário e do banco levará alguns minutos. Quando terminar, o progresso mudará de **Deployment in progress** para **Your deployment is complete**.

1. Selecione **Go to resource** para navegar até o banco do servidor secundário e continuar a próxima etapa.

## Fazer failover do SQL Database para uma região secundária

Agora que a réplica do Azure SQL Database foi criada, você realizará um failover.

1. Se você ainda não estiver no banco do servidor secundário, pesquise **sql databases** no Azure portal e selecione o SQL database **AdventureWorksLT** do servidor secundário.

1. No painel principal do SQL database, na seção **Data management**, selecione **Replicas**.

1. Observe que o link de geo-replicação está estabelecido. O valor *Replica state* do banco primário é **Online** e o *Replica state* das geo-replicas é **Readable**.

1. Selecione o menu **...** do servidor da geo-replica secundária e selecione **Forced Failover**.

    > &#128221; O forced failover alternará o banco secundário para a função de primário. Todas as sessões serão desconectadas durante a operação.

1. Quando a mensagem de aviso for exibida, selecione **Yes**.

1. O status da réplica primária mudará para **Pending** e o da secundária para **Failover**.

    > &#128221; Como o banco é pequeno, o failover será rápido. Em um ambiente de produção, esse processo pode levar alguns minutos.

1. Quando o processo terminar, as funções serão invertidas: a secundária se tornará a nova primária e a antiga primária se tornará secundária. Talvez seja necessário atualizar a página para ver o novo status.

Vimos que um banco secundário legível pode estar na mesma região do Azure que o primário ou, mais frequentemente, em outra região. Esse tipo de banco secundário legível também é chamado de geo-secondary ou geo-replica.

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

Agora você viu como habilitar geo-replicas para Azure SQL Database e fazer um failover manual para outra região usando o portal.
