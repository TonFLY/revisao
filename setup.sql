-- Execute este script no banco NossaRotina antes de iniciar o servidor

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'dp300_questions'
)
BEGIN
  CREATE TABLE dp300_questions (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    user_id       NVARCHAR(50)  NOT NULL DEFAULT 'default',
    exam          NVARCHAR(20)  NOT NULL DEFAULT 'DP-300',
    question      NVARCHAR(MAX) NOT NULL,
    option_a      NVARCHAR(MAX) NOT NULL,
    option_b      NVARCHAR(MAX) NOT NULL,
    option_c      NVARCHAR(MAX) NOT NULL,
    option_d      NVARCHAR(MAX) NOT NULL,
    correct       CHAR(1)       NOT NULL,
    explanation   NVARCHAR(MAX) NULL,
    topic         NVARCHAR(100) NOT NULL,
    difficulty    NVARCHAR(20)  NOT NULL DEFAULT 'medio',
    status        NVARCHAR(20)  NOT NULL DEFAULT 'pendente',
    created_at    DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME      NOT NULL DEFAULT GETDATE(),
    last_reviewed DATETIME      NULL
  );
  PRINT 'Tabela dp300_questions criada com sucesso.';
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dp300_questions') AND name='user_id')
  BEGIN
    ALTER TABLE dp300_questions ADD user_id NVARCHAR(50) NOT NULL DEFAULT 'default';
    PRINT 'Coluna user_id adicionada.';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dp300_questions') AND name='exam')
  BEGIN
    ALTER TABLE dp300_questions ADD exam NVARCHAR(20) NOT NULL DEFAULT 'DP-300';
    PRINT 'Coluna exam adicionada (todas as existentes ficam como DP-300).';
  END
  ELSE
    PRINT 'Tabela ja esta atualizada.';
END
