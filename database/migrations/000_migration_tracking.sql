-- Run once against the existing PersonalFinanceDB before other migrations.
-- This table tracks additive schema changes without recreating any data.
CREATE TABLE IF NOT EXISTS SchemaMigrations (
  MigrationID VARCHAR(100) NOT NULL,
  AppliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (MigrationID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
