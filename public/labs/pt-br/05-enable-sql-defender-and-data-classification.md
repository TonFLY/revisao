# Habilitar Microsoft Defender for SQL e classificação de dados

**Tempo estimado: 30 minutos**

Os alunos usarão as informações aprendidas nas aulas para configurar e, em seguida, implementar segurança no Azure portal e no banco AdventureWorks.

Você foi contratado como Administrador Sênior de Banco de Dados para ajudar a garantir a segurança do ambiente de banco de dados. Estas tarefas terão foco no Azure SQL Database.

> &#128221; Estes exercícios pedem que você copie e cole código T-SQL e usam recursos SQL já existentes. Antes de executar o código, confirme que ele foi copiado corretamente.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P), digite **Git: Clone** e selecione a opção **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, se nenhuma VM tiver sido fornecida. Crie a pasta se ela não existir.

## Configurar seu SQL Server no Azure

Entre no Azure e verifique se já existe uma instância de Azure SQL Server em execução. *Pule esta seção se você já tiver uma instância de SQL Server em execução no Azure.*

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code e navegue até o repositório clonado na seção anterior.

1. Clique com o botão direito na pasta **/Allfiles/Labs** e selecione **Open in Integrated Terminal**.

1. Conecte ao Azure usando o Azure CLI. Digite o comando abaixo e pressione **Enter**.

    ```bash
    az login
    ```

    > &#128221; Uma janela do navegador será aberta. Use suas credenciais do Azure para entrar.

1. Depois de entrar no Azure, crie um resource group caso ele ainda não exista e crie um SQL server e um database nesse grupo de recursos. Digite o comando abaixo e pressione **Enter**. *O script levará alguns minutos para ser concluído.*

    ```bash
    cd ./Setup
    ./deploy-sql-database.ps1
    ```

    > &#128221; Por padrão, esse script criará um resource group chamado **contoso-rg** ou usará um recurso cujo nome comece com *contoso-rg*, se já existir. Por padrão, os recursos também serão criados na região **West US 2** (westus2). Por fim, o script gerará uma senha aleatória de 12 caracteres para o **SQL admin password**. Você pode alterar esses valores usando os parâmetros **-rgName**, **-location** e **-sqlAdminPw**. A senha deve atender aos requisitos de complexidade de senha do Azure SQL: pelo menos 12 caracteres, contendo pelo menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial.

    > &#128221; O script adicionará seu endereço IP público atual às regras de firewall do SQL server.

1. Quando o script terminar, ele retornará o nome do resource group, o nome do SQL server, o nome do database e o nome de usuário e a senha do administrador. *Anote esses valores, pois eles serão necessários mais tarde no laboratório.*

---

## Habilitar Microsoft Defender for SQL

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra uma sessão do navegador e acesse [https://portal.azure.com](https://portal.azure.com/). Entre no portal usando suas credenciais do Azure.

1. No Azure portal, pesquise *SQL servers* na caixa de pesquisa na parte superior e selecione **SQL servers** na lista de opções.

1. Selecione o SQL server **dp300-lab-xxxxxxxx**, em que *xxxxxxxx* é uma sequência numérica aleatória.

    > &#128221; Se você estiver usando seu próprio Azure SQL server e ele não tiver sido criado por este laboratório, selecione o nome desse SQL server.

1. No painel *Overview*, selecione **Not configured** ao lado de *Microsoft Defender for SQL*.

1. Selecione o **X** no canto superior direito para fechar o painel Overview do *Microsoft Defender for Cloud*.

1. Selecione **Enable** em *Microsoft Defender for SQL*.

1. Em um ambiente de produção, várias recomendações deverão ser exibidas. Você deverá selecionar **View all recommendations in Defender for Cloud**, revisar todas as recomendações do *Microsoft Defender* listadas para seu Azure SQL Server e implementá-las conforme apropriado.

## Vulnerability Assessment

1. No painel principal do Azure SQL server, navegue até a seção **Settings**, selecione **SQL databases** e depois o banco chamado **AdventureWorksLT**.

1. Selecione **Microsoft Defender for Cloud** na seção **Security**.

1. Selecione o **X** no canto superior direito para fechar o painel Overview do *Microsoft Defender for Cloud* e visualizar o dashboard do **Microsoft Defender for Cloud** para o banco `AdventureWorksLT`.

1. Para começar a revisar os recursos de Vulnerability Assessment, em **Vulnerability assessment findings**, selecione **View additional findings in Vulnerability Assessment**.

1. Selecione **Scan** para obter os resultados mais atuais do Vulnerability Assessment. O processo levará alguns instantes enquanto o banco de dados é verificado.

1. Cada risco de segurança tem um nível de risco (high, medium ou low) e informações adicionais. As regras existentes são baseadas em benchmarks fornecidos pelo [Center for Internet Security](https://www.cisecurity.org/benchmark/microsoft_sql_server/?azure-portal=true). Na guia **Findings**, selecione uma vulnerabilidade. Anote o **ID** da vulnerabilidade, por exemplo **VA1143**, se ela estiver listada.

1. Dependendo da verificação de segurança, haverá visualizações e recomendações alternativas. Revise as informações fornecidas. Para essa verificação, você pode selecionar **Add all results as baseline** e depois **Yes** para definir o baseline. Agora que existe um baseline, essa verificação falhará em scans futuros se os resultados forem diferentes do baseline. Selecione o **X** no canto superior direito para fechar o painel da regra específica.

1. Execute **Scan** novamente e confirme que a vulnerabilidade selecionada agora aparece como uma verificação de segurança *Passed*.

    Se você selecionar a verificação de segurança aprovada, deverá conseguir ver o baseline configurado. Se algo mudar no futuro, os scans do Vulnerability Assessment detectarão a alteração e a verificação de segurança falhará.

## Advanced Threat Protection

1. Selecione o **X** no canto superior direito para fechar o painel do Vulnerability Assessment e voltar ao dashboard do **Microsoft Defender for Cloud** do banco. Em **Security incidents and alerts**, não deverá haver itens. Isso significa que o **Advanced Threat Protection** não detectou problemas. O Advanced Threat Protection detecta atividades anômalas que podem indicar tentativas incomuns e potencialmente mal-intencionadas de acessar ou explorar bancos de dados.

    > &#128221; Neste momento, não é esperado que você veja alertas de segurança. Na próxima etapa, você executará um teste que disparará um alerta para poder revisar os resultados no Advanced Threat Protection.

    Você pode usar o Advanced Threat Protection para identificar ameaças e receber alertas quando houver suspeita de qualquer um dos eventos abaixo:

    - SQL injection
    - Vulnerabilidade de SQL injection
    - Exfiltração de dados
    - Ação insegura
    - Brute force
    - Login anômalo de cliente

    Nesta seção, você aprenderá como um alerta de SQL Injection pode ser disparado pelo SSMS. Alertas de SQL Injection foram criados para aplicações personalizadas, e não para ferramentas padrão como o SSMS. Portanto, para disparar pelo SSMS um alerta usado como teste de SQL Injection, é necessário definir o **Application Name**, uma propriedade de conexão dos clientes que se conectam ao SQL Server ou Azure SQL.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o SQL Server Management Studio (SSMS). Na caixa de diálogo Connect to Server, cole o nome do servidor do Azure SQL Database e entre usando as credenciais abaixo:

    - **Server name:** &lt;_cole aqui o nome do servidor do Azure SQL Database_&gt;
    - **Authentication:** SQL Server Authentication
    - **Server admin login:** seu login de administrador do Azure SQL Database server
    - **Password:** sua senha de administrador do Azure SQL Database server

1. Selecione **Connect**.

1. No SSMS, selecione **File** > **New** > **Database Engine Query** para criar uma consulta usando uma nova conexão.

1. Na janela principal de login, entre no banco **AdventureWorksLT** como faria normalmente, usando SQL authentication, o nome do Azure SQL Server e as credenciais de administrador. Antes de conectar, selecione **Options >>** > **Connection Properties**. Em **Connect to database**, informe **AdventureWorksLT**.

1. Selecione a guia **Additional Connection Parameters** e insira a seguinte string de conexão na caixa de texto:

    ```sql
    Application Name=webappname
    ```

1. Selecione **Connect**.

1. Na nova janela de consulta, cole a consulta abaixo e selecione **Execute**:

    ```sql
    SELECT * FROM sys.databases WHERE database_id like '' or 1 = 1 --' and family = 'test1';
    ```

1. No Azure portal, abra o banco **AdventureWorksLT**. No painel esquerdo, em **Security**, selecione **Microsoft Defender for Cloud**.

1. Em **Security incidents and alerts**, selecione **Check for alerts on this resources in Microsoft Defender for Cloud**.

1. Agora você poderá ver os alertas gerais de segurança.

1. Selecione **Potential SQL injection** para exibir alertas mais específicos e receber etapas de investigação.

1. Selecione **View full details** para exibir os detalhes do alerta.

1. Na guia **Alert details**, observe que o *Vulnerable statement* é exibido. Essa é a instrução SQL que foi executada para disparar o alerta e é a mesma instrução executada no SSMS. Observe também que **Client application** aparece como **webappname**. Esse é o nome informado na string de conexão no SSMS.

1. Como etapa de limpeza, considere fechar todos os editores de consulta no SSMS e remover todas as conexões para não disparar alertas adicionais acidentalmente nos próximos exercícios.

## Habilitar classificação de dados

1. No painel principal do Azure SQL server, navegue até a seção **Settings**, selecione **SQL databases** e depois o banco chamado **AdventureWorksLT**.

1. No painel principal do banco **AdventureWorksLT**, navegue até a seção **Security** e selecione **Data Discovery & Classification**.

1. Na página **Data Discovery & Classification**, você verá uma mensagem informativa: **Currently using SQL Information Protection policy. We have found 15 columns with classification recommendations**. Selecione esse link.

1. Na tela seguinte de **Data Discovery & Classification**, marque a caixa ao lado de **Select all**, selecione **Accepted selected recommendations** e depois **Save** para salvar as classificações no banco de dados.

1. De volta à tela **Data Discovery & Classification**, observe que quinze colunas foram classificadas com sucesso em cinco tabelas diferentes. Revise o *Information type* e o *Sensitivity label* de cada coluna.

## Configurar classificação e mascaramento de dados

1. No Azure portal, acesse sua instância do Azure SQL Database **AdventureWorksLT** — não o logical server.

1. No painel esquerdo, em **Security**, selecione **Data Discovery & Classification**.

1. Na tabela SalesLT Customer, o *Data Discovery & Classification* identificou `FirstName` e `LastName` para classificação, mas não `MiddleName`. Use as listas suspensas para adicioná-la agora. Selecione **Name** em *Information type* e **Confidential - GDPR** em *Sensitivity label*. Depois selecione **Add classification**.

1. Selecione **Save**.

1. Confirme que a classificação foi adicionada com sucesso abrindo a guia **Overview** e verificando se `MiddleName` aparece na lista de colunas classificadas do schema SalesLT.

1. No painel esquerdo, selecione **Overview** para voltar à visão geral do banco de dados.

   O Dynamic Data Masking (DDM) está disponível no Azure SQL e no SQL Server. O DDM limita a exposição de dados ao mascarar dados sensíveis para usuários não privilegiados no nível do SQL Server, em vez de implementar essas regras no nível da aplicação. O Azure SQL recomenda itens que podem ser mascarados, e você também pode adicionar máscaras manualmente.

   Nas próximas etapas, você mascarará as colunas `FirstName`, `MiddleName` e `LastName`, revisadas na etapa anterior.

1. No Azure portal, acesse seu Azure SQL Database. No painel esquerdo, em **Security**, selecione **Dynamic Data Masking** e depois **Add mask**.

1. Nas listas suspensas, selecione o schema **SalesLT**, a tabela **Customer** e a coluna **FirstName**. Você pode revisar as opções de mascaramento, mas a opção padrão é adequada para este cenário. Selecione **Add** para adicionar a regra de mascaramento.

1. Repita as etapas anteriores para **MiddleName** e **LastName** na mesma tabela.

    Agora você terá três regras de mascaramento.

1. Selecione **Save**.

    > &#128221; Se o nome do seu Azure SQL Server não for composto somente por letras minúsculas, números e hífens, esta etapa falhará e você não conseguirá continuar com as seções de data masking.

1. No painel esquerdo, selecione **Overview** para voltar à visão geral do banco de dados.

## Recuperar dados classificados e mascarados

Em seguida, você simulará alguém consultando as colunas classificadas e explorará o Dynamic Data Masking em funcionamento.

1. Abra o SQL Server Management Studio (SSMS), conecte ao Azure SQL server e abra uma nova janela de consulta.

1. Clique com o botão direito no banco **AdventureWorksLT** e selecione **New Query**.

1. Execute a consulta abaixo para retornar os dados classificados e, em alguns casos, as colunas marcadas para mascaramento. Selecione **Execute** para executar a consulta.

    ```sql
    SELECT TOP 10 FirstName, MiddleName, LastName
    FROM SalesLT.Customer;
    ```

    O resultado deverá exibir os 10 primeiros nomes sem mascaramento. Por quê? Porque você é o administrador desse logical server do Azure SQL Database.

1. Na consulta a seguir, você criará um novo usuário e executará a consulta anterior como esse usuário. Você também usará `EXECUTE AS` para representar `Bob`. Quando uma instrução `EXECUTE AS` é executada, o contexto de execução da sessão é alterado para o login ou usuário especificado. Isso significa que as permissões passam a ser verificadas para esse login ou usuário, e não para a pessoa que executou o comando `EXECUTE AS` — neste caso, você. Depois, `REVERT` é usado para encerrar a representação do login ou usuário.

    As primeiras partes dos comandos a seguir podem parecer familiares porque repetem etapas de um exercício anterior. Crie uma nova consulta com os comandos abaixo, selecione **Execute** e observe os resultados.

    ```sql
    -- Create a new SQL user and give them a password
    CREATE USER Bob WITH PASSWORD = 'c0mpl3xPassword!';

    -- Until you run the following two lines, Bob has no access to read or write data
    ALTER ROLE db_datareader ADD MEMBER Bob;
    ALTER ROLE db_datawriter ADD MEMBER Bob;

    -- Execute as our new, low-privilege user, Bob
    EXECUTE AS USER = 'Bob';
    SELECT TOP 10 FirstName, MiddleName, LastName
    FROM SalesLT.Customer;
    REVERT;
    ```

    Agora o resultado deverá exibir os 10 primeiros nomes com mascaramento aplicado. Bob não recebeu acesso à forma não mascarada desses dados.

    E se Bob precisar acessar os nomes completos e receber permissão para isso?

    Você pode atualizar os usuários excluídos do mascaramento no Azure portal, acessando o painel **Dynamic Data Masking** em **Security**, ou pode fazer isso usando T-SQL.

1. Clique com o botão direito no banco **AdventureWorksLT**, selecione **New Query** e execute a consulta abaixo para permitir que Bob consulte os nomes sem mascaramento. Selecione **Execute**.

    ```sql
    GRANT UNMASK TO Bob;  
    EXECUTE AS USER = 'Bob';
    SELECT TOP 10 FirstName, MiddleName, LastName
    FROM SalesLT.Customer;
    REVERT;  
    ```

    Os resultados deverão exibir os nomes completos.

1. Você também pode remover o privilégio de unmask de um usuário e confirmar a alteração executando os comandos T-SQL abaixo em uma nova consulta:

    ```sql
    -- Remove unmasking privilege
    REVOKE UNMASK TO Bob;  

    -- Execute as Bob
    EXECUTE AS USER = 'Bob';
    SELECT TOP 10 FirstName, MiddleName, LastName
    FROM SalesLT.Customer;
    REVERT;  
    ```

    Os resultados deverão voltar a exibir os nomes mascarados.

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

Se você criou uma nova pasta LabFiles para este laboratório e não precisa mais dela, poderá excluí-la para remover todos os arquivos criados durante o lab.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, abra o File Explorer e navegue até a unidade **C:\**.
1. Clique com o botão direito na pasta **LabFiles** e selecione **Delete**.
1. Selecione **Yes** para confirmar a exclusão da pasta.

---

Você concluiu este laboratório com sucesso.

Neste exercício, você reforçou a segurança de um Azure SQL Database habilitando o Microsoft Defender for SQL. Também criou colunas classificadas com base nas recomendações do Azure portal.
