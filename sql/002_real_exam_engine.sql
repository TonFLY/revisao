/* ============================================================
   Certification Review — REAL Exam Engine v2
   Backward compatible with the existing dp300_questions table.
   Run once in the same SQL Server database used by the app.
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- richer question model ---------- */
IF COL_LENGTH('dbo.dp300_questions', 'question_type') IS NULL
  ALTER TABLE dbo.dp300_questions ADD question_type NVARCHAR(40) NOT NULL
    CONSTRAINT DF_dp300_questions_question_type DEFAULT N'single_choice';
GO

IF COL_LENGTH('dbo.dp300_questions', 'origin') IS NULL
  ALTER TABLE dbo.dp300_questions ADD origin NVARCHAR(20) NOT NULL
    CONSTRAINT DF_dp300_questions_origin DEFAULT N'legacy';
GO

IF COL_LENGTH('dbo.dp300_questions', 'domain_code') IS NULL
  ALTER TABLE dbo.dp300_questions ADD domain_code NVARCHAR(40) NULL;
GO

IF COL_LENGTH('dbo.dp300_questions', 'interaction_json') IS NULL
  ALTER TABLE dbo.dp300_questions ADD interaction_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.dp300_questions', 'correct_json') IS NULL
  ALTER TABLE dbo.dp300_questions ADD correct_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.dp300_questions', 'case_id') IS NULL
  ALTER TABLE dbo.dp300_questions ADD case_id NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.dp300_questions', 'case_json') IS NULL
  ALTER TABLE dbo.dp300_questions ADD case_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.dp300_questions', 'points') IS NULL
  ALTER TABLE dbo.dp300_questions ADD points INT NOT NULL
    CONSTRAINT DF_dp300_questions_points DEFAULT 1;
GO

IF COL_LENGTH('dbo.dp300_questions', 'realism_level') IS NULL
  ALTER TABLE dbo.dp300_questions ADD realism_level TINYINT NOT NULL
    CONSTRAINT DF_dp300_questions_realism_level DEFAULT 1;
GO

/* Rich formats do not always use four A-D options. */
ALTER TABLE dbo.dp300_questions ALTER COLUMN option_a NVARCHAR(MAX) NULL;
ALTER TABLE dbo.dp300_questions ALTER COLUMN option_b NVARCHAR(MAX) NULL;
ALTER TABLE dbo.dp300_questions ALTER COLUMN option_c NVARCHAR(MAX) NULL;
ALTER TABLE dbo.dp300_questions ALTER COLUMN option_d NVARCHAR(MAX) NULL;
ALTER TABLE dbo.dp300_questions ALTER COLUMN correct CHAR(1) NULL;
GO

UPDATE dbo.dp300_questions
SET question_type = COALESCE(NULLIF(question_type, N''), N'single_choice'),
    origin = COALESCE(NULLIF(origin, N''), N'legacy'),
    points = CASE WHEN points IS NULL OR points < 1 THEN 1 ELSE points END,
    realism_level = CASE WHEN realism_level IS NULL OR realism_level < 1 THEN 1 ELSE realism_level END;
GO

/* ---------- attempt history: make it generic ---------- */
IF OBJECT_ID(N'dbo.question_attempts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.question_attempts
  (
    attempt_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_question_attempts PRIMARY KEY,
    question_id INT NOT NULL,
    user_id NVARCHAR(100) NOT NULL,
    exam NVARCHAR(40) NOT NULL,
    selected_answer CHAR(1) NULL,
    correct_answer CHAR(1) NULL,
    selected_json NVARCHAR(MAX) NULL,
    correct_json NVARCHAR(MAX) NULL,
    question_type NVARCHAR(40) NULL,
    is_correct BIT NOT NULL,
    points_earned DECIMAL(10,2) NULL,
    points_max DECIMAL(10,2) NULL,
    study_mode NVARCHAR(30) NULL,
    session_id UNIQUEIDENTIFIER NULL,
    response_ms INT NULL,
    answered_at DATETIME2(0) NOT NULL CONSTRAINT DF_question_attempts_answered_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_question_attempts_question FOREIGN KEY(question_id)
      REFERENCES dbo.dp300_questions(id) ON DELETE CASCADE
  );
END;
GO

IF COL_LENGTH('dbo.question_attempts', 'selected_json') IS NULL
  ALTER TABLE dbo.question_attempts ADD selected_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.question_attempts', 'correct_json') IS NULL
  ALTER TABLE dbo.question_attempts ADD correct_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.question_attempts', 'question_type') IS NULL
  ALTER TABLE dbo.question_attempts ADD question_type NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.question_attempts', 'points_earned') IS NULL
  ALTER TABLE dbo.question_attempts ADD points_earned DECIMAL(10,2) NULL;
IF COL_LENGTH('dbo.question_attempts', 'points_max') IS NULL
  ALTER TABLE dbo.question_attempts ADD points_max DECIMAL(10,2) NULL;
IF COL_LENGTH('dbo.question_attempts', 'session_id') IS NULL
  ALTER TABLE dbo.question_attempts ADD session_id UNIQUEIDENTIFIER NULL;
GO

/* Existing v1 columns were NOT NULL. Rich questions need them nullable. */
IF COL_LENGTH('dbo.question_attempts', 'selected_answer') IS NOT NULL
  ALTER TABLE dbo.question_attempts ALTER COLUMN selected_answer CHAR(1) NULL;
IF COL_LENGTH('dbo.question_attempts', 'correct_answer') IS NOT NULL
  ALTER TABLE dbo.question_attempts ALTER COLUMN correct_answer CHAR(1) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.question_attempts')
    AND name = N'IX_question_attempts_user_exam_question'
)
BEGIN
  CREATE INDEX IX_question_attempts_user_exam_question
    ON dbo.question_attempts(user_id, exam, question_id, answered_at DESC)
    INCLUDE(is_correct, study_mode, points_earned, points_max, session_id);
END;
GO

/* ---------- exam sessions ---------- */
IF OBJECT_ID(N'dbo.exam_sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.exam_sessions
  (
    session_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_exam_sessions PRIMARY KEY DEFAULT NEWID(),
    user_id NVARCHAR(100) NOT NULL,
    exam NVARCHAR(40) NOT NULL,
    mode NVARCHAR(20) NOT NULL CONSTRAINT DF_exam_sessions_mode DEFAULT N'real',
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_exam_sessions_status DEFAULT N'in_progress',
    question_count INT NOT NULL,
    duration_minutes INT NOT NULL,
    started_at DATETIME2(0) NOT NULL CONSTRAINT DF_exam_sessions_started_at DEFAULT SYSUTCDATETIME(),
    submitted_at DATETIME2(0) NULL,
    points_earned DECIMAL(10,2) NULL,
    points_max DECIMAL(10,2) NULL,
    raw_score_pct DECIMAL(6,2) NULL,
    CONSTRAINT CK_exam_sessions_status CHECK(status IN (N'in_progress', N'submitted', N'expired'))
  );
END;
GO

IF OBJECT_ID(N'dbo.exam_session_questions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.exam_session_questions
  (
    session_id UNIQUEIDENTIFIER NOT NULL,
    position INT NOT NULL,
    question_id INT NOT NULL,
    answer_json NVARCHAR(MAX) NULL,
    marked_for_review BIT NOT NULL CONSTRAINT DF_exam_session_questions_review DEFAULT 0,
    answered_at DATETIME2(0) NULL,
    response_ms INT NULL,
    is_correct BIT NULL,
    points_earned DECIMAL(10,2) NULL,
    points_max DECIMAL(10,2) NULL,
    CONSTRAINT PK_exam_session_questions PRIMARY KEY(session_id, position),
    CONSTRAINT UQ_exam_session_questions_question UNIQUE(session_id, question_id),
    CONSTRAINT FK_exam_session_questions_session FOREIGN KEY(session_id)
      REFERENCES dbo.exam_sessions(session_id) ON DELETE CASCADE,
    CONSTRAINT FK_exam_session_questions_question FOREIGN KEY(question_id)
      REFERENCES dbo.dp300_questions(id)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.exam_sessions')
    AND name = N'IX_exam_sessions_user_exam_started'
)
BEGIN
  CREATE INDEX IX_exam_sessions_user_exam_started
    ON dbo.exam_sessions(user_id, exam, started_at DESC)
    INCLUDE(status, raw_score_pct, question_count, duration_minutes);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.dp300_questions')
    AND name = N'IX_dp300_questions_real_pool'
)
BEGIN
  CREATE INDEX IX_dp300_questions_real_pool
    ON dbo.dp300_questions(user_id, exam, origin, domain_code, question_type, realism_level)
    INCLUDE(status, topic, difficulty, case_id, points);
END;
GO

/* ---------- performance view (keeps old use cases working) ---------- */
CREATE OR ALTER VIEW dbo.v_question_performance
AS
SELECT
  q.id AS question_id,
  q.user_id,
  q.exam,
  q.topic,
  q.domain_code,
  q.question_type,
  q.origin,
  q.difficulty,
  q.status,
  COUNT(a.attempt_id) AS attempt_count,
  COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_count,
  COALESCE(SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong_count,
  CAST(
    CASE WHEN COUNT(a.attempt_id) = 0 THEN NULL
         ELSE 100.0 * SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(a.attempt_id)
    END AS DECIMAL(5,2)
  ) AS historical_accuracy_pct,
  MAX(a.answered_at) AS last_attempt_at,
  MAX(CASE WHEN a.is_correct = 0 THEN a.answered_at END) AS last_wrong_at,
  MAX(CASE WHEN a.is_correct = 1 THEN a.answered_at END) AS last_correct_at
FROM dbo.dp300_questions q
LEFT JOIN dbo.question_attempts a
  ON a.question_id = q.id
 AND a.user_id = q.user_id
 AND a.exam = q.exam
GROUP BY
  q.id, q.user_id, q.exam, q.topic, q.domain_code, q.question_type,
  q.origin, q.difficulty, q.status;
GO

PRINT 'REAL Exam Engine v2 migration complete.';
