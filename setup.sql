-- Execute este script no banco NossaRotina antes de iniciar o servidor

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'dp300_questions'
)
BEGIN
  CREATE TABLE dp300_questions (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    question      NVARCHAR(MAX) NOT NULL,
    option_a      NVARCHAR(MAX) NOT NULL,
    option_b      NVARCHAR(MAX) NOT NULL,
    option_c      NVARCHAR(MAX) NOT NULL,
    option_d      NVARCHAR(MAX) NOT NULL,
    correct       CHAR(1)       NOT NULL,  -- 'A', 'B', 'C' ou 'D'
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
  PRINT 'Tabela dp300_questions ja existe.';
