# Provisionar um SQL Server em uma Máquina Virtual do Azure

**Tempo estimado: 30 minutos**

Os alunos explorarão o Azure portal e o usarão para criar uma VM do Azure com SQL Server 2022 instalado. Em seguida, conectarão à máquina virtual por Remote Desktop Protocol (RDP).

Você é o administrador de banco de dados da AdventureWorks. Precisa criar um ambiente de teste para uma prova de conceito. A prova de conceito usará SQL Server em uma Máquina Virtual do Azure e um backup do banco AdventureWorksDW. Você precisa configurar a máquina virtual, restaurar o banco de dados e consultá-lo para confirmar que está disponível.

## Implantar um SQL Server em uma Máquina Virtual do Azure

1. Abra uma sessão do navegador, acesse [https://portal.azure.com](https://portal.azure.com/) e entre usando a conta Microsoft associada à sua assinatura do Azure.

1. Localize a barra de pesquisa na parte superior da página. Pesquise **Azure SQL**. Selecione o resultado **Azure SQL** exibido em **Services**.

1. Na barra lateral, expanda **SQL server** e selecione **SQL server on Azure VMs**. Em seguida, selecione **Create**.

1. No painel **Select SQL deployment option**, selecione a caixa suspensa em **SQL virtual machines**. Escolha **Free SQL Server License: SQL Server 2022 Developer on Windows Server 2022**. Em seguida, selecione **Create**.

1. Na página **Create a virtual machine**, informe os dados abaixo e *mantenha todas as demais opções com os valores padrão*:

    - **Subscription:** &lt;Sua assinatura&gt;
    - **Resource group:** &lt;Seu grupo de recursos&gt;
    - **Virtual machine name:** AzureSQLServerVM
    - **Region:** &lt;Escolha sua região local, a mesma região selecionada para o grupo de recursos.&gt;
    - **Availability Options:** No infrastructure redundancy required
    - **Image:** Free SQL Server License: SQL Server 2022 Developer on Windows Server 2022 - Gen2
    - **Run with Azure spot discount:** No (desmarcado)
    - **Size:** Standard *D2s_v5* (2 vCPUs, 8 GiB de memória). *Talvez seja necessário selecionar o link “See all sizes” para encontrar essa opção.*
    - **Administrator account username:** &lt;Escolha um nome para a conta de administrador.&gt;
    - **Administrator account password:** &lt;Escolha uma senha forte.&gt;
    - **Select inbound ports:** RDP (3389)
    - **Would you like to use an existing Windows Server license?:** No (desmarcado)

    > &#128221; Anote o nome de usuário e a senha para usá-los mais tarde.

1. Acesse a guia **Disks** e revise a configuração.

1. Acesse a guia **Networking** e revise a configuração.

1. Acesse a guia **Management** e revise a configuração.

    Confirme que **Enable auto_shutdown** está desmarcado.

1. Acesse a guia **Advanced** e revise a configuração.

1. Acesse a guia **SQL Server settings** e revise a configuração.

    > &#128221; Observe que você também pode configurar o armazenamento da VM SQL Server nesta tela. Por padrão, os templates de SQL Server em Azure VM criam um disco Premium com cache de leitura para os dados, um disco Premium sem cache para o transaction log e usam o SSD local (D:\ no Windows) para o tempdb.

1. Selecione **Review + create**. Em seguida, selecione **Create**.

1. No painel de implantação, aguarde até que o deployment seja concluído. A VM levará aproximadamente 5 a 10 minutos para ser implantada. Quando a implantação terminar, selecione **Go to resource**.

    > &#128221; Sua implantação pode levar vários minutos para ser concluída.

1. Na página **Overview** da máquina virtual, explore as opções de menu do recurso para revisar o que está disponível.

---

## Conectar ao SQL Server em uma Máquina Virtual do Azure

1. Na página **Overview** da máquina virtual, selecione o menu **Connect** e, em seguida, selecione **Connect**.

1. No painel Connect, selecione **Download RDP File**.

    > &#128221; Se aparecer o erro **Port prerequisite not met**, selecione o link para adicionar uma regra de entrada no network security group usando a porta indicada no campo *Port number*.

1. Abra o arquivo RDP que acabou de ser baixado. Quando aparecer uma caixa de diálogo perguntando se deseja conectar, selecione **Connect**.

1. Informe o nome de usuário e a senha escolhidos durante o provisionamento da máquina virtual. Em seguida, selecione **OK**.

1. Quando a caixa de diálogo **Remote Desktop Connection** perguntar se deseja conectar, selecione **Yes**.

1. Selecione a barra de pesquisa ao lado do botão Iniciar do Windows e digite SSMS. Na lista, selecione **Microsoft SQL Server Management Studio**.

1. Quando o SSMS abrir, observe que a caixa de diálogo **Connect to Server** estará previamente preenchida com o nome da instância padrão. Marque **Trust server certificate** e selecione **Connect**.

1. Feche o SSMS selecionando o **X** no canto superior direito.

1. Agora você pode desconectar da máquina virtual e encerrar a sessão RDP.

O Azure portal oferece ferramentas poderosas para administrar um SQL Server hospedado em uma máquina virtual. Essas ferramentas incluem controle sobre patching automatizado, backups automatizados e uma forma simplificada de configurar alta disponibilidade.

---

## Limpar os recursos

Se você não for usar a máquina virtual para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos que você criou para este laboratório. Ele conterá a máquina virtual e outros recursos criados durante o lab.

1. Selecione **Delete resource group** no menu superior.

1. Na caixa de diálogo **Delete resource group**, digite o nome do grupo de recursos para confirmar e selecione **Delete**.

1. Aguarde a exclusão do grupo de recursos.

1. Feche o Azure portal.

### Excluir somente os recursos do laboratório

Se você não criou um novo grupo de recursos para este lab e deseja manter o grupo e os recursos que já existiam, ainda poderá excluir somente os recursos criados neste laboratório.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos usado neste laboratório. Ele conterá a máquina virtual e os demais recursos criados no lab.

1. Selecione todos os recursos cujo nome começa com o nome da máquina virtual que você informou anteriormente no laboratório.

1. Selecione **Delete** no menu superior.

1. Na caixa de diálogo **Delete resources**, digite **delete** e selecione **Delete**.

1. Selecione **Delete** novamente para confirmar a exclusão dos recursos.

1. Aguarde a exclusão dos recursos.

1. Feche o Azure portal.

---

Você concluiu este laboratório com sucesso.
