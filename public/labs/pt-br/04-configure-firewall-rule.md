# Implementar um ambiente seguro

**Tempo estimado: 30 minutos**

Os alunos usarão as informações aprendidas nas aulas para configurar e, em seguida, implementar segurança no Azure portal e dentro do banco *AdventureWorksLT*.

Você foi contratado como Administrador Sênior de Banco de Dados para ajudar a garantir a segurança do ambiente de banco de dados. Estas tarefas terão foco no Azure SQL Database.

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

1. Depois de entrar no Azure, crie um resource group caso ele ainda não exista e crie um SQL server e um database nesse grupo de recursos. Digite o comando abaixo e pressione **Enter**. *O script levará alguns minutos para ser concluído.*

    ```bash
    cd ./Setup
    ./deploy-sql-database.ps1
    ```

    > &#128221; Por padrão, esse script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, todos os recursos também serão criados na região **West US 2** (westus2). Por fim, o script gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando um ou mais parâmetros **-rgName**, **-location** e **-sqlAdminPw**. A senha deve atender aos requisitos de complexidade de senha do Azure SQL: pelo menos 12 caracteres, contendo pelo menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. *Anote esses valores, pois eles serão necessários mais tarde no laboratório.*

---

## Configurar regras de firewall do Azure SQL Database

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, pesquise *SQL servers* na caixa de pesquisa na parte superior e selecione **SQL servers** na lista de opções.

1. Selecione o SQL server **dp300-lab-xxxxxxxx**, em que *xxxxxxxx* é uma sequência numérica aleatória.

    > &#128221; Se você estiver usando seu próprio Azure SQL server e ele não tiver sido criado por este laboratório, selecione o nome desse SQL server.

1. Na tela *Overview* do SQL server, à direita do nome do servidor, selecione o botão **Copy to clipboard**.

1. Selecione **Show networking settings**.

1. Na página **Networking**, em **Firewall rules**, revise a lista e confirme que o endereço IP do seu cliente está presente. Se não estiver, selecione **+ Add your client IPv4 address (your IP address)** e depois **Save**.

    > &#128221; Seu endereço IP de cliente é preenchido automaticamente. Adicioná-lo à lista permitirá conectar ao Azure SQL Database usando SQL Server Management Studio (SSMS) ou outras ferramentas cliente. **Anote seu endereço IP de cliente; ele será usado mais tarde.**

1. Abra o SQL Server Management Studio. Na caixa de diálogo Connect to Server, cole o nome do servidor do Azure SQL Database e entre usando as credenciais abaixo:

    - **Server name:** &lt;_cole aqui o nome do servidor do Azure SQL Database_&gt;
    - **Authentication:** SQL Server Authentication
    - **Server admin login:** seu login de administrador do Azure SQL Database server
    - **Password:** sua senha de administrador do Azure SQL Database server

1. Selecione **Connect**.

1. No Object Explorer, expanda o nó do servidor e clique com o botão direito em **Databases**. Selecione **Import a Data-tier Application**.

1. Na caixa de diálogo **Import Data Tier Application**, selecione **Next** na primeira tela.

1. Na tela **Import Settings**, selecione **Browse** e navegue até a pasta **C:\LabFiles\dp-300-database-administrator\Allfiles\Labs\04**. Selecione o arquivo **AdventureWorksLT.bacpac** e depois **Open**. De volta à tela **Import Data-tier Application**, selecione **Next**.

1. Na tela **Database Settings**, faça as alterações abaixo:

    - **Database name:** AdventureWorksFromBacpac
    - **Edition of Microsoft Azure SQL Database:** Basic

1. Selecione **Next**.

1. Na tela **Summary**, selecione **Finish**. Isso pode levar alguns minutos. Quando a importação for concluída, os resultados serão exibidos. Em seguida, selecione **Close**.

1. De volta ao SQL Server Management Studio, no **Object Explorer**, expanda a pasta **Databases**. Clique com o botão direito no banco **AdventureWorksFromBacpac** e selecione **New Query**.

1. Execute a consulta T-SQL abaixo colando o texto na janela de consulta.
    1. **Importante:** substitua **000.000.000.000** pelo endereço IP do seu cliente. Selecione **Execute**.

    ```sql
    EXECUTE sp_set_database_firewall_rule 
            @name = N'AWFirewallRule',
            @start_ip_address = '000.000.000.000', 
            @end_ip_address = '000.000.000.000'
    ```

1. Em seguida, crie um usuário contido no banco **AdventureWorksFromBacpac**. Selecione **New Query** e execute o T-SQL abaixo.

    ```sql
    USE [AdventureWorksFromBacpac]
    GO
    CREATE USER ContainedDemo WITH PASSWORD = 'P@ssw0rd01'
    ```

    > &#128221; Esse comando cria um usuário contido dentro do banco **AdventureWorksFromBacpac**. Você testará essa credencial na próxima etapa.

1. Navegue até o **Object Explorer**. Selecione **Connect** e depois **Database Engine**.

1. Tente conectar usando as credenciais criadas na etapa anterior. Use as informações abaixo:

    - **Login:** ContainedDemo
    - **Password:** P@ssw0rd01

     Selecione **Connect**.

     Você receberá o erro abaixo.

    <span style="color:red">Login failed for user 'ContainedDemo'. (Microsoft SQL Server, Error: 18456)</span>

    > &#128221; Esse erro ocorre porque a conexão tentou entrar no banco *master*, e não em **AdventureWorksFromBacpac**, onde o usuário foi criado. Altere o contexto da conexão selecionando **OK** para fechar a mensagem de erro e depois selecione **Options >>** em **Connect to Server**.

1. Na guia **Connection Properties**, digite o nome do banco **AdventureWorksFromBacpac** e selecione **Connect**.

1. Observe que agora foi possível autenticar com sucesso usando o usuário **ContainedDemo**. Desta vez, você entrou diretamente em **AdventureWorksFromBacpac**, que é o único banco ao qual o usuário recém-criado tem acesso.

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

Neste exercício, você configurou regras de firewall no nível de servidor e no nível de banco para acessar um banco hospedado no Azure SQL Database. Também usou instruções T-SQL para criar um usuário contido e o SQL Server Management Studio para validar o acesso.
