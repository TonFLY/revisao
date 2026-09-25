# Configurar autenticação e autorização de banco de dados

**Tempo estimado: 25 minutos**

Os alunos usarão as informações aprendidas nas aulas para configurar e, em seguida, implementar segurança no Azure portal e dentro do banco *AdventureWorksLT*.

Você foi contratado como Administrador Sênior de Banco de Dados para ajudar a garantir a segurança do ambiente de banco de dados.

> &#128221; Estes exercícios pedem que você copie e cole código T-SQL e usam recursos SQL já existentes. Antes de executar o código, confirme que ele foi copiado corretamente.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P) e digite **Git: Clone**. Selecione a opção **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, se nenhuma VM tiver sido fornecida. Crie a pasta se ela não existir.

## Configurar seu SQL Server no Azure

Entre no Azure e verifique se já existe uma instância de Azure SQL Server em execução. *Pule esta seção se você já tiver uma instância de SQL Server em execução no Azure.*

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code e navegue até o repositório clonado na seção anterior.

1. Clique com o botão direito na pasta **/Allfiles/Labs** e selecione **Open in Integrated Terminal**.

1. Vamos conectar ao Azure usando o Azure CLI. Digite o comando abaixo e pressione **Enter**.

    ```bash
    az login
    ```

    > &#128221; Uma janela do navegador será aberta. Use suas credenciais do Azure para entrar.

1. Depois de entrar no Azure, é hora de criar um resource group caso ele ainda não exista e criar um SQL server e um database nesse grupo de recursos. Digite o comando abaixo e pressione **Enter**. *O script levará alguns minutos para ser concluído.*

    ```bash
    cd ./Setup
    ./deploy-sql-database.ps1
    ```

    > &#128221; Por padrão, esse script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, todos os recursos também serão criados na região **West US 2** (westus2). Por fim, o script gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando um ou mais parâmetros **-rgName**, **-location** e **-sqlAdminPw** com os valores desejados. A senha deve atender aos requisitos de complexidade de senha do Azure SQL: pelo menos 12 caracteres, contendo pelo menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. Anote esses valores, pois eles serão necessários mais tarde no laboratório.

---

## Autorizar acesso ao Azure SQL Database com Microsoft Entra

Você pode criar logins a partir de contas do Microsoft Entra como usuários contidos de banco de dados usando a sintaxe T-SQL `CREATE USER [anna@contoso.com] FROM EXTERNAL PROVIDER`. Um usuário contido de banco de dados é mapeado para uma identidade no diretório Microsoft Entra associado ao banco e não possui login no banco `master`.

Com a introdução de logins de servidor do Microsoft Entra no Azure SQL Database, você pode criar logins a partir de principals do Microsoft Entra no banco virtual `master` de um SQL Database. É possível criar logins Microsoft Entra a partir de *usuários, grupos e service principals* do Microsoft Entra. Para obter mais informações, consulte [Microsoft Entra server principals](/azure/azure-sql/database/authentication-azure-ad-logins).

Além disso, no Azure portal você só pode criar administradores, e as funções de Azure role-based access control não são propagadas para os logical servers do Azure SQL Database. Permissões adicionais de servidor e banco de dados devem ser concedidas usando Transact-SQL (T-SQL). Vamos criar um administrador Microsoft Entra para o SQL server.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. Na página inicial do Azure portal, pesquise **SQL servers** e selecione o resultado.

1. Selecione o SQL server **dp300-lab-xxxxxxxx**, em que *xxxxxxxx* é uma sequência numérica aleatória.

    > &#128221; Se você estiver usando seu próprio Azure SQL server e ele não tiver sido criado por este laboratório, selecione o nome desse SQL server.

1. No painel *Overview*, selecione **Not configured** ao lado de *Microsoft Entra admin*.

1. Na tela seguinte, selecione **Set admin**.

1. Na barra lateral **Microsoft Entra ID**, pesquise o nome de usuário do Azure com o qual você entrou no Azure portal e selecione **Select**.

1. Selecione **Save** para concluir o processo. Seu nome de usuário se tornará o Microsoft Entra admin do servidor.

1. À esquerda, selecione **Overview** e copie o **Server name**.

1. Abra o SQL Server Management Studio (SSMS) e selecione **Connect** > **Database Engine**. Em **Server name**, cole o nome do seu servidor. Altere o tipo de autenticação para **Microsoft Entra MFA**.

1. Selecione **Connect**.

## Gerenciar acesso a objetos do banco de dados

Nesta tarefa, você gerenciará o acesso ao banco de dados e aos seus objetos. Primeiro, você criará dois usuários no banco *AdventureWorksLT*.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o SSMS e entre no banco *AdventureWorksLT* usando a conta de Azure Server admin ou a conta Microsoft Entra admin.

1. Use o **Object Explorer** e expanda **Databases**.

1. Clique com o botão direito em **AdventureWorksLT** e selecione **New Query**.

1. Na nova janela de consulta, copie e cole o T-SQL abaixo. Execute a consulta para criar os dois usuários.

    ```sql
    CREATE USER [DP300User1] WITH PASSWORD = 'Azur3Pa$$';
    GO

    CREATE USER [DP300User2] WITH PASSWORD = 'Azur3Pa$$';
    GO
    ```

    **Observação:** esses usuários são criados no escopo do banco AdventureWorksLT. Em seguida, você criará uma role personalizada e adicionará os usuários a ela.

1. Execute o T-SQL abaixo na mesma janela de consulta.

    ```sql
    CREATE ROLE [SalesReader];
    GO

    ALTER ROLE [SalesReader] ADD MEMBER [DP300User1];
    GO

    ALTER ROLE [SalesReader] ADD MEMBER [DP300User2];
    GO
    ```

    Em seguida, crie uma nova stored procedure no schema **SalesLT**.

1. Execute o T-SQL abaixo na janela de consulta.

    ```sql
    CREATE OR ALTER PROCEDURE SalesLT.DemoProc
    AS
    SELECT P.Name, Sum(SOD.LineTotal) as TotalSales ,SOH.OrderDate
    FROM SalesLT.Product P
    INNER JOIN SalesLT.SalesOrderDetail SOD on SOD.ProductID = P.ProductID
    INNER JOIN SalesLT.SalesOrderHeader SOH on SOH.SalesOrderID = SOD.SalesOrderID
    GROUP BY P.Name, SOH.OrderDate
    ORDER BY TotalSales DESC
    GO
    ```

    Em seguida, use a sintaxe `EXECUTE AS USER` para testar a segurança. Isso permite que o mecanismo de banco de dados execute uma consulta no contexto do usuário especificado.

1. Execute o seguinte T-SQL.

    ```sql
    EXECUTE AS USER = 'DP300User1'
    EXECUTE SalesLT.DemoProc
    ```

    O comando falhará com a mensagem:

    <span style="color:red">Msg 229, Level 14, State 5, Procedure SalesLT.DemoProc, Line 1 [Batch Start Line 0]
    The EXECUTE permission was denied on the object 'DemoProc', database 'AdventureWorksLT', schema 'SalesLT'.</span>

1. Em seguida, conceda permissões à role para permitir que ela execute a stored procedure. Execute o T-SQL abaixo.

    ```sql
    REVERT;
    GRANT EXECUTE ON SCHEMA::SalesLT TO [SalesReader];
    GO
    ```

    O primeiro comando retorna o contexto de execução para o proprietário do banco de dados.

1. Execute novamente o T-SQL anterior.

    ```sql
    EXECUTE AS USER = 'DP300User1'
    EXECUTE SalesLT.DemoProc
    ```

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

1. Abra o grupo de recursos usado neste laboratório. Ele conterá o Azure SQL Server e os demais recursos criados durante o lab.

1. Selecione todos os recursos cujo nome começa com o nome do SQL Server informado anteriormente no laboratório.

1. Selecione **Delete** no menu superior.

1. Na caixa de diálogo **Delete resources**, digite **delete** e selecione **Delete**.

1. Selecione **Delete** novamente para confirmar a exclusão dos recursos.

1. Aguarde a exclusão dos recursos.

1. Feche o Azure portal.

### Excluir a pasta LabFiles

Se você criou uma nova pasta LabFiles para este laboratório e não precisa mais dela, poderá excluir a pasta para remover todos os arquivos criados durante o lab.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o File Explorer e navegue até a unidade **C:\**.
1. Clique com o botão direito na pasta **LabFiles** e selecione **Delete**.
1. Selecione **Yes** para confirmar a exclusão da pasta.

---

Você concluiu este laboratório com sucesso.

Neste exercício, você viu como usar o Microsoft Entra ID para permitir que credenciais do Azure acessem um SQL Server hospedado no Azure. Você também usou instruções T-SQL para criar novos usuários de banco de dados e conceder permissões para que eles executem stored procedures.
