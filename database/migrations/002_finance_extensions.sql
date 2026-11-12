-- Additive finance extensions. Run after 001_add_opening_balance.sql.
-- Every statement is safe for an existing database when applied once.

CREATE TABLE IF NOT EXISTS Transfers (
  TransferID INT NOT NULL AUTO_INCREMENT,
  UserID INT NOT NULL,
  SourceAccountID INT NOT NULL,
  DestinationAccountID INT NOT NULL,
  Amount DECIMAL(12,2) NOT NULL,
  Description VARCHAR(255) NULL,
  TransferDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (TransferID),
  CONSTRAINT transfers_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  CONSTRAINT transfers_source_fk FOREIGN KEY (SourceAccountID) REFERENCES Accounts(AccountID),
  CONSTRAINT transfers_destination_fk FOREIGN KEY (DestinationAccountID) REFERENCES Accounts(AccountID),
  CONSTRAINT transfers_amount_chk CHECK (Amount > 0),
  CONSTRAINT transfers_accounts_chk CHECK (SourceAccountID <> DestinationAccountID),
  INDEX idx_transfers_user_date (UserID, TransferDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS AccountBalanceSnapshots (
  SnapshotID INT NOT NULL AUTO_INCREMENT,
  AccountID INT NOT NULL,
  UserID INT NOT NULL,
  SnapshotMonth DATE NOT NULL,
  OpeningBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ExpectedBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ActualBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  Difference DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ReconciledAt DATETIME NULL,
  PRIMARY KEY (SnapshotID),
  UNIQUE KEY uq_account_snapshot_month (AccountID, SnapshotMonth),
  CONSTRAINT snapshots_account_fk FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID),
  CONSTRAINT snapshots_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  INDEX idx_snapshots_user_month (UserID, SnapshotMonth)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS AuditLogs (
  AuditID BIGINT NOT NULL AUTO_INCREMENT,
  UserID INT NULL,
  OperationType VARCHAR(30) NOT NULL,
  TableName VARCHAR(64) NOT NULL,
  RecordID VARCHAR(64) NOT NULL,
  OldValue JSON NULL,
  NewValue JSON NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (AuditID),
  CONSTRAINT audit_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  INDEX idx_audit_table_record (TableName, RecordID),
  INDEX idx_audit_user_date (UserID, CreatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SavingsGoals (
  GoalID INT NOT NULL AUTO_INCREMENT,
  UserID INT NOT NULL,
  GoalName VARCHAR(100) NOT NULL,
  TargetAmount DECIMAL(12,2) NOT NULL,
  CurrentAmount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  Deadline DATE NULL,
  Status ENUM('ACTIVE','COMPLETED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (GoalID),
  CONSTRAINT goals_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  CONSTRAINT goals_target_chk CHECK (TargetAmount > 0),
  CONSTRAINT goals_current_chk CHECK (CurrentAmount >= 0),
  INDEX idx_goals_user_status (UserID, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS GoalContributions (
  ContributionID INT NOT NULL AUTO_INCREMENT,
  GoalID INT NOT NULL,
  UserID INT NOT NULL,
  Amount DECIMAL(12,2) NOT NULL,
  ContributionDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Note VARCHAR(255) NULL,
  PRIMARY KEY (ContributionID),
  CONSTRAINT contributions_goal_fk FOREIGN KEY (GoalID) REFERENCES SavingsGoals(GoalID),
  CONSTRAINT contributions_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  CONSTRAINT contributions_amount_chk CHECK (Amount > 0),
  INDEX idx_contributions_goal_date (GoalID, ContributionDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS RecurringTransactions (
  RecurringTransactionID INT NOT NULL AUTO_INCREMENT,
  UserID INT NOT NULL,
  AccountID INT NOT NULL,
  CategoryID INT NOT NULL,
  Amount DECIMAL(12,2) NOT NULL,
  TransactionType ENUM('INCOME','EXPENSE') NOT NULL,
  Frequency ENUM('WEEKLY','MONTHLY','YEARLY') NOT NULL,
  NextExecutionDate DATE NOT NULL,
  Description VARCHAR(255) NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (RecurringTransactionID),
  CONSTRAINT recurring_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  CONSTRAINT recurring_account_fk FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID),
  CONSTRAINT recurring_category_fk FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID),
  CONSTRAINT recurring_amount_chk CHECK (Amount > 0),
  INDEX idx_recurring_due (UserID, IsActive, NextExecutionDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS RecurringTransactionExecutions (
  ExecutionID INT NOT NULL AUTO_INCREMENT,
  RecurringTransactionID INT NOT NULL,
  TransactionID INT NULL,
  ScheduledDate DATE NOT NULL,
  ExecutedAt DATETIME NULL,
  Status ENUM('PENDING','EXECUTED','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  ErrorMessage VARCHAR(255) NULL,
  PRIMARY KEY (ExecutionID),
  UNIQUE KEY uq_recurring_schedule (RecurringTransactionID, ScheduledDate),
  CONSTRAINT executions_recurring_fk FOREIGN KEY (RecurringTransactionID) REFERENCES RecurringTransactions(RecurringTransactionID),
  CONSTRAINT executions_transaction_fk FOREIGN KEY (TransactionID) REFERENCES Transactions(TransactionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS TransactionAttachments (
  AttachmentID INT NOT NULL AUTO_INCREMENT,
  TransactionID INT NOT NULL,
  UserID INT NOT NULL,
  FileName VARCHAR(255) NOT NULL,
  StorageKey VARCHAR(500) NOT NULL,
  MimeType VARCHAR(100) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (AttachmentID),
  CONSTRAINT attachments_transaction_fk FOREIGN KEY (TransactionID) REFERENCES Transactions(TransactionID),
  CONSTRAINT attachments_user_fk FOREIGN KEY (UserID) REFERENCES Users(UserID),
  INDEX idx_attachments_transaction (TransactionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO SchemaMigrations (MigrationID)
VALUES ('002_finance_extensions');
