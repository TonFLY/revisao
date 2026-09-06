/*
  Execute este script no banco NossaRotina antes de iniciar o servidor.

  Versão do schema: 1.2

  Compatibilidade:
  - Mantém as questões antigas funcionando.
  - Mantém explanation como texto.
  - Adiciona campos opcionais para explicação estruturada.
  - Suporta DP-300 e DP-800 na mesma tabela.
*/

IF OBJECT_ID('dbo.dp300_questions', 'U') IS NULL
BEGIN

    CREATE TABLE dbo.dp300_questions
    (
        id              INT            IDENTITY(1,1) PRIMARY KEY,

        user_id         NVARCHAR(50)   NOT NULL
            CONSTRAINT DF_dp300_questions_user_id
            DEFAULT 'default',

        exam            NVARCHAR(20)   NOT NULL
            CONSTRAINT DF_dp300_questions_exam
            DEFAULT 'DP-300',

        question        NVARCHAR(MAX)  NOT NULL,

        option_a        NVARCHAR(MAX)  NOT NULL,
        option_b        NVARCHAR(MAX)  NOT NULL,
        option_c        NVARCHAR(MAX)  NOT NULL,
        option_d        NVARCHAR(MAX)  NOT NULL,

        correct         CHAR(1)        NOT NULL,

        /*
          Explicação antiga/resumida.
          Mantida para compatibilidade com o app atual.
        */
        explanation     NVARCHAR(MAX)  NULL,

        /*
          Nova estrutura de aprendizado
        */

        -- Por que a alternativa correta está correta
        why_correct     NVARCHAR(MAX)  NULL,

        -- Por que cada alternativa está errada
        why_a_wrong     NVARCHAR(MAX)  NULL,
        why_b_wrong     NVARCHAR(MAX)  NULL,
        why_c_wrong     NVARCHAR(MAX)  NULL,
        why_d_wrong     NVARCHAR(MAX)  NULL,

        -- Palavra ou expressão que deve chamar atenção na prova
        exam_keyword    NVARCHAR(500)  NULL,

        -- Regra curta para memorização
        memory_rule     NVARCHAR(MAX)  NULL,

        -- Principal pegadinha/distrator da questão
        trap            NVARCHAR(MAX)  NULL,

        /*
          Origem / validação da questão
        */

        -- Ex.: Microsoft Learn, Microsoft Docs, material DP-800
        source_name     NVARCHAR(200)  NULL,

        -- URL da documentação utilizada para validar a questão
        source_url      NVARCHAR(2000) NULL,

        -- 1 = questão validada contra fonte confiável/oficial
        verified        BIT            NOT NULL
            CONSTRAINT DF_dp300_questions_verified
            DEFAULT 0,

        topic           NVARCHAR(100)  NOT NULL,

        difficulty      NVARCHAR(20)   NOT NULL
            CONSTRAINT DF_dp300_questions_difficulty
            DEFAULT 'medio',

        status          NVARCHAR(20)   NOT NULL
            CONSTRAINT DF_dp300_questions_status
            DEFAULT 'pendente',

        created_at      DATETIME       NOT NULL
            CONSTRAINT DF_dp300_questions_created_at
            DEFAULT GETDATE(),

        updated_at      DATETIME       NOT NULL
            CONSTRAINT DF_dp300_questions_updated_at
            DEFAULT GETDATE(),

        last_reviewed   DATETIME       NULL
    );

    PRINT 'Tabela dbo.dp300_questions criada com schema 1.2.';

END

ELSE
BEGIN

    PRINT 'Tabela dbo.dp300_questions encontrada. Verificando atualizacoes...';


    /* =========================================================
       CAMPOS BASE
       ========================================================= */

    IF COL_LENGTH('dbo.dp300_questions', 'user_id') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD user_id NVARCHAR(50) NOT NULL
            CONSTRAINT DF_dp300_questions_user_id
            DEFAULT 'default';

        PRINT 'Coluna user_id adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'exam') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD exam NVARCHAR(20) NOT NULL
            CONSTRAINT DF_dp300_questions_exam
            DEFAULT 'DP-300';

        PRINT 'Coluna exam adicionada. Questoes existentes permanecem como DP-300.';
    END;


    /* =========================================================
       EXPLICACAO ESTRUTURADA
       ========================================================= */

    IF COL_LENGTH('dbo.dp300_questions', 'why_correct') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD why_correct NVARCHAR(MAX) NULL;

        PRINT 'Coluna why_correct adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'why_a_wrong') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD why_a_wrong NVARCHAR(MAX) NULL;

        PRINT 'Coluna why_a_wrong adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'why_b_wrong') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD why_b_wrong NVARCHAR(MAX) NULL;

        PRINT 'Coluna why_b_wrong adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'why_c_wrong') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD why_c_wrong NVARCHAR(MAX) NULL;

        PRINT 'Coluna why_c_wrong adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'why_d_wrong') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD why_d_wrong NVARCHAR(MAX) NULL;

        PRINT 'Coluna why_d_wrong adicionada.';
    END;


    /* =========================================================
       MEMORIZACAO
       ========================================================= */

    IF COL_LENGTH('dbo.dp300_questions', 'exam_keyword') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD exam_keyword NVARCHAR(500) NULL;

        PRINT 'Coluna exam_keyword adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'memory_rule') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD memory_rule NVARCHAR(MAX) NULL;

        PRINT 'Coluna memory_rule adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'trap') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD trap NVARCHAR(MAX) NULL;

        PRINT 'Coluna trap adicionada.';
    END;


    /* =========================================================
       FONTE / VALIDACAO
       ========================================================= */

    IF COL_LENGTH('dbo.dp300_questions', 'source_name') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD source_name NVARCHAR(200) NULL;

        PRINT 'Coluna source_name adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'source_url') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD source_url NVARCHAR(2000) NULL;

        PRINT 'Coluna source_url adicionada.';
    END;


    IF COL_LENGTH('dbo.dp300_questions', 'verified') IS NULL
    BEGIN
        ALTER TABLE dbo.dp300_questions
        ADD verified BIT NOT NULL
            CONSTRAINT DF_dp300_questions_verified
            DEFAULT 0;

        PRINT 'Coluna verified adicionada.';
    END;


    PRINT 'Schema dbo.dp300_questions atualizado com sucesso para versao 1.2.';

END;
GO