IF OBJECT_ID(N'dbo.dp300_flashcards',N'U') IS NULL
CREATE TABLE dbo.dp300_flashcards (
 id INT IDENTITY(1,1) PRIMARY KEY,
 user_id NVARCHAR(100) NOT NULL,
 exam NVARCHAR(40) NOT NULL DEFAULT N'DP-300',
 front NVARCHAR(MAX) NOT NULL,
 back NVARCHAR(MAX) NOT NULL,
 topic NVARCHAR(200) NULL,
 source_question_id INT NULL,
 created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.dp300_flashcard_progress',N'U') IS NULL
CREATE TABLE dbo.dp300_flashcard_progress (
 user_id NVARCHAR(100) NOT NULL,
 exam NVARCHAR(40) NOT NULL,
 card_id INT NOT NULL,
 interval_days INT NOT NULL DEFAULT 0,
 ease FLOAT NOT NULL DEFAULT 2.5,
 repetitions INT NOT NULL DEFAULT 0,
 due_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 last_grade NVARCHAR(12) NULL,
 updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT PK_dp300_flashcard_progress PRIMARY KEY(user_id,exam,card_id),
 CONSTRAINT FK_dp300_flashcard_progress_card FOREIGN KEY(card_id) REFERENCES dbo.dp300_flashcards(id) ON DELETE CASCADE
);
CREATE INDEX IX_dp300_flashcards_user_exam ON dbo.dp300_flashcards(user_id,exam);
CREATE INDEX IX_dp300_flashcard_progress_due ON dbo.dp300_flashcard_progress(user_id,exam,due_at);
