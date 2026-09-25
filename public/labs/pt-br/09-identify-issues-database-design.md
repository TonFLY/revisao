# Identificar problemas de design do banco de dados

**Tempo estimado: 15 minutos**

Os alunos usarão as informações aprendidas nas aulas para definir os entregáveis de um projeto de transformação digital na AdventureWorks. Examinando o Azure portal e outras ferramentas, determinarão como usar ferramentas nativas para identificar e resolver problemas relacionados a desempenho. Ao final, serão capazes de avaliar um design de banco de dados em busca de problemas de normalização, escolha de tipos de dados e desenho de índices.

Você foi contratado como administrador de banco de dados para identificar problemas de desempenho e fornecer soluções viáveis para os problemas encontrados. A AdventureWorks vende bicicletas e peças de bicicletas diretamente para consumidores e distribuidores há mais de uma década. Seu trabalho é identificar problemas de performance das consultas e corrigi-los usando as técnicas aprendidas neste módulo.

> &#128221; Estes exercícios pedem que você copie e cole código T-SQL. Antes de executar o código, confirme que ele foi copiado corretamente.

## Configurar o ambiente

Se a máquina virtual do laboratório tiver sido fornecida e pré-configurada, os arquivos do laboratório deverão estar disponíveis na pasta **C:\LabFiles**. *Reserve um momento para conferir. Se os arquivos já estiverem lá, pule esta seção.* Porém, se você estiver usando sua própria máquina ou os arquivos do laboratório estiverem ausentes, será necessário cloná-los do *GitHub* para continuar.

1. Na máquina virtual do laboratório, ou na sua máquina local se nenhuma VM tiver sido fornecida, inicie uma sessão do Visual Studio Code.

1. Abra a command palette (Ctrl+Shift+P), digite **Git: Clone** e selecione **Git: Clone**.

1. Cole a URL abaixo no campo **Repository URL** e pressione **Enter**.

    ```url
    https://github.com/MicrosoftLearning/dp-300-database-administrator.git
    ```

1. Salve o repositório na pasta **C:\LabFiles** da máquina virtual do laboratório ou da sua máquina local, criando a pasta se necessário.

---

## Restaurar um banco de dados

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

## Examinar a consulta e identificar o problema

1. Selecione **New Query**. Copie e cole o T-SQL abaixo na janela de consulta. Selecione **Execute** para executar a consulta.

    ```sql
    USE AdventureWorks2017

    GO
    
    SELECT BusinessEntityID, NationalIDNumber, LoginID, HireDate, JobTitle
    FROM HumanResources.Employee
    WHERE NationalIDNumber = 14417807;
    ```

1. Antes de executar a consulta, selecione o ícone **Include Actual Execution Plan** à direita do botão **Execute** ou pressione **CTRL+M**. Isso fará com que o plano de execução seja exibido quando a consulta for executada. Selecione **Execute**.

1. Acesse o plano de execução selecionando a guia **Execution plan** no painel de resultados. Observe que o operador **SELECT** apresenta um triângulo amarelo com um ponto de exclamação. Isso indica que existe uma mensagem de aviso associada ao operador. Passe o mouse sobre o ícone de aviso para ver e ler a mensagem.

    > &#128221; A mensagem de aviso informa que existe uma conversão implícita na consulta. Isso significa que o otimizador de consultas do SQL Server precisou converter o tipo de dados de uma das colunas para outro tipo para poder executar a consulta.

## Identificar formas de corrigir a mensagem de aviso

A estrutura da tabela *[HumanResources].[Employee]* é definida pela instrução DDL abaixo. Compare os campos usados na consulta SQL anterior com essa definição e preste atenção aos tipos de dados.

```sql
CREATE TABLE [HumanResources].[Employee](
     [BusinessEntityID] [int] NOT NULL,
     [NationalIDNumber] [nvarchar](15) NOT NULL,
     [LoginID] [nvarchar](256) NOT NULL,
     [OrganizationNode] [hierarchyid] NULL,
     [OrganizationLevel] AS ([OrganizationNode].[GetLevel]()),
     [JobTitle] [nvarchar](50) NOT NULL,
     [BirthDate] [date] NOT NULL,
     [MaritalStatus] [nchar](1) NOT NULL,
     [Gender] [nchar](1) NOT NULL,
     [HireDate] [date] NOT NULL,
     [SalariedFlag] [dbo].[Flag] NOT NULL,
     [VacationHours] [smallint] NOT NULL,
     [SickLeaveHours] [smallint] NOT NULL,
     [CurrentFlag] [dbo].[Flag] NOT NULL,
     [rowguid] [uniqueidentifier] ROWGUIDCOL NOT NULL,
     [ModifiedDate] [datetime] NOT NULL
) ON [PRIMARY]
```

1. De acordo com a mensagem de aviso apresentada no plano de execução, que alteração você recomendaria?

    1. Identifique qual campo está causando a conversão implícita e por quê.
    1. Revise a consulta:

        ```sql
        SELECT BusinessEntityID, NationalIDNumber, LoginID, HireDate, JobTitle
        FROM HumanResources.Employee
        WHERE NationalIDNumber = 14417807;
        ```

        Observe que o valor comparado à coluna *NationalIDNumber* na cláusula **WHERE** está sendo tratado como número, pois **14417807** não está entre aspas.

        Ao examinar a estrutura da tabela, você verá que a coluna *NationalIDNumber* usa o tipo **NVARCHAR**, e não **INT**. Essa inconsistência faz com que o otimizador converta implicitamente o número para um valor *NVARCHAR*, adicionando overhead à consulta e produzindo um plano subótimo.

Existem duas abordagens para corrigir o aviso de conversão implícita. Você investigará cada uma nas próximas etapas.

### Alterar o código

1. Como você alteraria o código para resolver a conversão implícita? Faça a alteração e execute novamente a consulta.

    Lembre-se de habilitar **Include Actual Execution Plan** (**CTRL+M**) se a opção ainda não estiver habilitada.

    Neste cenário, basta colocar o valor entre aspas simples para convertê-lo de número para texto. Mantenha a janela de consulta aberta.

    Execute a consulta SQL atualizada:

    ```sql
    SELECT BusinessEntityID, NationalIDNumber, LoginID, HireDate, JobTitle
    FROM HumanResources.Employee
    WHERE NationalIDNumber = '14417807';
    ```

    > &#128221; Observe que a mensagem de aviso desapareceu e o plano de consulta melhorou. Ao alterar a cláusula *WHERE* para que o valor comparado à coluna *NationalIDNumber* corresponda ao tipo de dados da coluna na tabela, o otimizador consegue eliminar a conversão implícita e gerar um plano mais adequado.

### Alterar o tipo de dados

1. Também podemos corrigir o aviso de conversão implícita alterando a estrutura da tabela.

    Para tentar corrigir o problema, copie e cole a consulta abaixo em uma nova janela e tente executá-la selecionando **Execute** ou pressionando <kbd>F5</kbd>.

    ```sql
    ALTER TABLE [HumanResources].[Employee] ALTER COLUMN [NationalIDNumber] INT NOT NULL;
    ```

    Alterar o tipo da coluna *NationalIDNumber* para INT resolveria o problema de conversão. Porém, essa mudança introduz outro problema que você, como administrador de banco de dados, precisa resolver. A execução da consulta acima resultará na seguinte mensagem de erro:

    <span style="color:red">Msg 5074, Level 16, Sate 1, Line1
    The index 'AK_Employee_NationalIDNumber' is dependent on column 'NationalIDNumber
    Msg 4922, Level 16, State 9, Line 1
    ALTER TABLE ALTER COLUMN NationalIDNumber failed because one or more objects access this column</span>

    A coluna *NationalIDNumber* faz parte de um índice nonclustered já existente. O índice precisa ser reconstruído/recriado para que o tipo de dados seja alterado. **Isso pode causar downtime prolongado em produção, destacando a importância de escolher os tipos de dados corretos ainda durante o design.**

1. Para resolver o problema, copie e cole o código abaixo na janela de consulta e execute-o selecionando **Execute**.

    ```sql
    USE AdventureWorks2017

    GO
    
    --Dropping the index first
    DROP INDEX [AK_Employee_NationalIDNumber] ON [HumanResources].[Employee]

    GO

    --Changing the column data type to resolve the implicit conversion warning
    ALTER TABLE [HumanResources].[Employee] ALTER COLUMN [NationalIDNumber] INT NOT NULL;

    GO

    --Recreating the index
    CREATE UNIQUE NONCLUSTERED INDEX [AK_Employee_NationalIDNumber] ON [HumanResources].[Employee]( [NationalIDNumber] ASC );

    GO
    ```

1. Execute a consulta abaixo para confirmar que o tipo de dados foi alterado com sucesso.

    ```sql
    SELECT c.name, t.name
    FROM sys.all_columns c INNER JOIN sys.types t
    	ON (c.system_type_id = t.user_type_id)
    WHERE OBJECT_ID('[HumanResources].[Employee]') = c.object_id
        AND c.name = 'NationalIDNumber'
    ```

1. Agora verifique o plano de execução. Execute novamente a consulta original, sem as aspas.

    ```sql
    USE AdventureWorks2017
    GO

    SELECT BusinessEntityID, NationalIDNumber, LoginID, HireDate, JobTitle
    FROM HumanResources.Employee
    WHERE NationalIDNumber = 14417807;
    ```

     Examine o plano e observe que agora é possível usar um inteiro para filtrar por *NationalIDNumber* sem o aviso de conversão implícita. O otimizador de consultas SQL pode gerar e executar um plano mais adequado.

> &#128221; Embora alterar o tipo de dados de uma coluna possa resolver problemas de conversão implícita, isso nem sempre é a melhor solução. Neste caso, mudar *NationalIDNumber* para **INT** causaria downtime em produção, pois o índice da coluna precisaria ser removido e recriado. É importante considerar o impacto de alterar o tipo de uma coluna sobre consultas e índices existentes antes de fazer a mudança. Além disso, outras consultas podem depender de *NationalIDNumber* ser **NVARCHAR**, e a alteração poderia quebrá-las.

---

## Limpeza

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

Neste exercício, você aprendeu a identificar problemas de consulta causados por conversões implícitas de tipo de dados e como corrigi-los para melhorar o plano de execução.
