# Provisionar um Azure SQL Database

**Tempo estimado: 40 minutos**

Os alunos configurarão os recursos básicos necessários para implantar um Azure SQL Database com um Virtual Network Endpoint. A conectividade com o SQL Database será validada usando o SQL Server Management Studio a partir da VM do laboratório, se disponível, ou a partir da sua máquina local configurada.

Como administrador de banco de dados da AdventureWorks, você configurará um novo SQL Database, incluindo um Virtual Network Endpoint para aumentar e simplificar a segurança da implantação. O SQL Server Management Studio será usado para avaliar o uso de um SQL Notebook para consulta de dados e retenção dos resultados.

## Navegar pelo Azure portal

1. Na máquina virtual do laboratório, se ela tiver sido fornecida, ou na sua máquina local, abra uma janela do navegador.

1. Acesse o Azure portal em [https://portal.azure.com](https://portal.azure.com/). Entre no Azure portal usando sua conta do Azure ou as credenciais fornecidas, se houver.

1. No Azure portal, pesquise *resource groups* na caixa de pesquisa na parte superior e selecione **Resource groups** na lista de opções.

1. Na página **Resource group**, se ele tiver sido fornecido, selecione o grupo de recursos cujo nome começa com *contoso-rg*. Se esse grupo de recursos não existir, crie um novo grupo de recursos com nome começando por *contoso-rg* na sua região local ou use um grupo de recursos existente e anote a região em que ele está.

## Criar uma Virtual Network

1. Na página inicial do Azure portal, selecione o menu do lado esquerdo.

1. No painel de navegação esquerdo, selecione **Virtual Networks**.

1. Selecione **+ Create** para abrir a página **Create Virtual Network**. Na guia **Basics**, preencha as seguintes informações:

    - **Subscription:** &lt;Sua assinatura&gt;
    - **Resource group:** um nome começando com *DP300* ou o grupo de recursos selecionado anteriormente
    - **Name:** lab02-vnet
    - **Region:** selecione a mesma região em que seu grupo de recursos foi criado

1. Selecione **Review + Create**, revise as configurações da nova rede virtual e selecione **Create**.

## Provisionar um Azure SQL Database no Azure portal

1. No Azure portal, pesquise *SQL databases* na caixa de pesquisa na parte superior e selecione **Azure SQL databases** na lista de serviços.

1. Na página **Azure SQL databases**, selecione **+ Create**.

1. Na página **Create SQL Database**, na guia **Basics**, selecione as opções abaixo e depois selecione **Next: Networking**.

    - **Subscription:** &lt;Sua assinatura&gt;
    - **Resource group:** um nome começando com *DP300* ou o grupo de recursos selecionado anteriormente
    - **Database Name:** AdventureWorksLT
    - **Server:** selecione o link **Create new**. A página **Create SQL Database Server** será aberta. Informe os detalhes do servidor da seguinte forma:
        - **Server name:** dp300-lab-&lt;suas iniciais em minúsculas&gt; e, se necessário, um número aleatório de 5 dígitos (o nome do servidor deve ser globalmente exclusivo)
        - **Location:** &lt;sua região local, a mesma região selecionada para o grupo de recursos; caso contrário, a operação poderá falhar&gt;
        - **Authentication method:** Use SQL authentication
        - **Server admin login:** dp300admin
        - **Password:** escolha uma senha complexa e anote-a
        - **Confirm password:** informe a mesma senha escolhida anteriormente
    - Selecione **OK** para voltar à página **Create SQL Database**.
    - **Want to use Elastic Pool?** defina como **No**.
    - **Workload environment:** Development
    - Em **Compute + Storage**, selecione o link **Configure database**. Na página **Configure**, em **Service tier**, selecione **Basic** e depois **Apply**.

1. Em **Backup storage redundancy**, mantenha o valor padrão: **Locally-redundant backup storage**.

1. Em seguida, selecione **Next: Networking**.

1. Na guia **Networking**, em **Network Connectivity**, selecione a opção **Private endpoint**.

1. Em seguida, selecione o link **+ Add private endpoint** em **Private endpoints**.

1. Preencha o painel **Create private endpoint** à direita da seguinte forma:

    - **Subscription:** &lt;Sua assinatura&gt;
    - **Resource group:** um nome começando com *DP300* ou o grupo de recursos selecionado anteriormente
    - **Location:** &lt;sua região local, a mesma região selecionada para o grupo de recursos; caso contrário, a operação poderá falhar&gt;
    - **Name:** DP-300-SQL-Endpoint
    - **Target sub-resource:** SqlServer
    - **Virtual network:** lab02-vnet
    - **Subnet:** lab02-vnet/default (10.x.0.0/24)
    - **Integrate with private DNS zone:** Yes
    - **Private DNS zone:** mantenha o valor padrão
    - Revise as configurações e selecione **OK**

1. O novo endpoint aparecerá na lista **Private endpoints**.

1. Selecione **Next: Security** e depois **Next: Additional settings**.

1. Na página **Additional settings**, selecione **Sample** em **Use existing data**. Se aparecer uma mensagem pop-up para o banco de exemplo, selecione **OK**.

1. Selecione **Review + Create**.

1. Revise as configurações antes de selecionar **Create**.

1. Quando o deployment for concluído, selecione **Go to resource**.

## Habilitar acesso a um Azure SQL Database

1. Na página **SQL database**, selecione a seção **Overview** e depois selecione o link com o nome do servidor na parte superior.

1. No painel de navegação de SQL servers, selecione **Networking** na seção **Security**.

1. Na guia **Public access**, selecione **Selected networks**.

1. Selecione **+ Add your client IPv4 address**. Isso adicionará uma regra de firewall permitindo que seu endereço IP atual acesse o SQL server.

1. Marque a propriedade **Allow Azure services and resources to access this server**.

1. Selecione **Save**.

---

## Conectar a um Azure SQL Database no SQL Server Management Studio

1. No Azure portal, selecione o recurso **SQL database** e depois selecione o banco **AdventureWorksLT**.

1. Copie o valor **Server name** na página **Overview**.

1. Inicie o SQL Server Management Studio na máquina virtual do laboratório, se ela tiver sido fornecida, ou na sua máquina local.

1. Na caixa de diálogo **Connect to Server**, cole o valor de **Server name** copiado do Azure portal.

1. Na lista **Authentication**, selecione **SQL Server Authentication**.

1. No campo **Login**, informe **dp300admin**.

1. No campo **Password**, informe a senha escolhida durante a criação do SQL server.

1. Selecione **Connect**.

1. O SQL Server Management Studio se conectará ao seu servidor do Azure SQL Database. Expanda o servidor e depois o nó **Databases** para ver o banco *AdventureWorksLT*.

## Consultar um Azure SQL Database com o SQL Server Management Studio

1. No SQL Server Management Studio, clique com o botão direito no banco *AdventureWorksLT* e selecione **New Query**.

1. Cole a instrução SQL abaixo na janela de consulta:

    ```sql
    SELECT TOP 10 cust.[CustomerID], 
        cust.[CompanyName], 
        SUM(sohead.[SubTotal]) as OverallOrderSubTotal
    FROM [SalesLT].[Customer] cust
        INNER JOIN [SalesLT].[SalesOrderHeader] sohead
             ON sohead.[CustomerID] = cust.[CustomerID]
    GROUP BY cust.[CustomerID], cust.[CompanyName]
    ORDER BY [OverallOrderSubTotal] DESC
    ```

1. Selecione o botão **Execute** na barra de ferramentas para executar a consulta.

1. No painel **Results**, revise os resultados da consulta.

1. Clique com o botão direito no banco *AdventureWorksLT* e selecione **New Query**.

1. Cole a instrução SQL abaixo na janela de consulta:

    ```sql
    SELECT TOP 10 cat.[Name] AS ProductCategory, 
        SUM(detail.[OrderQty]) AS OrderedQuantity
    FROM salesLT.[ProductCategory] cat
        INNER JOIN [SalesLT].[Product] prod
            ON prod.[ProductCategoryID] = cat.[ProductCategoryID]
        INNER JOIN [SalesLT].[SalesOrderDetail] detail
            ON detail.[ProductID] = prod.[ProductID]
    GROUP BY cat.[name]
    ORDER BY [OrderedQuantity] DESC
    ```

1. Selecione o botão **Execute** na barra de ferramentas para executar a consulta.

1. No painel **Results**, revise os resultados da consulta.

1. Feche o SQL Server Management Studio. Se for perguntado se deseja salvar alterações, selecione **No**.

---

## Limpar os recursos

Se você não for usar os recursos para nenhuma outra finalidade, poderá remover os recursos criados neste laboratório.

### Excluir o grupo de recursos

Se você criou um novo grupo de recursos para este laboratório, pode excluí-lo para remover todos os recursos criados nele.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos que você criou para este laboratório. Ele conterá os recursos criados durante o lab.

1. Selecione **Delete resource group** no menu superior.

1. Na caixa de diálogo **Delete resource group**, digite o nome do grupo de recursos para confirmar e selecione **Delete**.

1. Aguarde a exclusão do grupo de recursos.

1. Feche o Azure portal.

### Excluir somente os recursos do laboratório

Se você não criou um novo grupo de recursos para este lab e deseja manter o grupo e os recursos que já existiam, ainda poderá excluir somente os recursos criados neste laboratório.

1. No Azure portal, selecione **Resource groups** no painel de navegação esquerdo ou pesquise **Resource groups** na barra de pesquisa e selecione o resultado.

1. Abra o grupo de recursos usado neste laboratório.

1. Selecione todos os recursos cujo nome começa com o nome do SQL Server informado anteriormente no laboratório. Além disso, selecione a virtual network e a private DNS zone que você criou.

1. Selecione **Delete** no menu superior.

1. Na caixa de diálogo **Delete resources**, digite **delete** e selecione **Delete**.

1. Selecione **Delete** novamente para confirmar a exclusão dos recursos.

1. Aguarde a exclusão dos recursos.

1. Feche o Azure portal.

---

Você concluiu este laboratório com sucesso.

Neste exercício, você viu como implantar um Azure SQL Database com um Virtual Network Endpoint. Também conseguiu se conectar ao SQL Database criado usando o SQL Server Management Studio.
