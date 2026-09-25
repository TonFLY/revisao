/* DP-300 Labs — progresso por usuário
   Seguro para executar mais de uma vez.
*/
IF OBJECT_ID(N'dbo.dp300_lab_progress', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.dp300_lab_progress
  (
    user_id        NVARCHAR(100) NOT NULL,
    exam           NVARCHAR(40)  NOT NULL CONSTRAINT DF_dp300_lab_progress_exam DEFAULT N'DP-300',
    lab_id         NVARCHAR(120) NOT NULL,
    status         NVARCHAR(20)  NOT NULL CONSTRAINT DF_dp300_lab_progress_status DEFAULT N'not_started',
    completed      BIT           NOT NULL CONSTRAINT DF_dp300_lab_progress_completed DEFAULT 0,
    started_at     DATETIME2(0)  NULL,
    completed_at   DATETIME2(0)  NULL,
    last_opened_at DATETIME2(0)  NULL,
    notes          NVARCHAR(4000) NULL,
    updated_at     DATETIME2(0)  NOT NULL CONSTRAINT DF_dp300_lab_progress_updated DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_dp300_lab_progress PRIMARY KEY (user_id, exam, lab_id),
    CONSTRAINT CK_dp300_lab_progress_status CHECK (status IN (N'not_started',N'in_progress',N'completed'))
  );

  CREATE INDEX IX_dp300_lab_progress_user_status
    ON dbo.dp300_lab_progress(user_id, exam, status, updated_at DESC);
END;
GO
