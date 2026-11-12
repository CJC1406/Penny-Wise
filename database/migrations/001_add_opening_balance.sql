-- Additive migration. Run this against the existing PersonalFinanceDB after a backup.
-- It preserves every existing row and records the current balance as the opening
-- baseline for the ledger going forward; it does not recreate or drop tables.
SET @opening_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Accounts' AND column_name = 'OpeningBalance');
SET @opening_sql = IF(@opening_exists = 0, 'ALTER TABLE Accounts ADD COLUMN OpeningBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE opening_stmt FROM @opening_sql;
EXECUTE opening_stmt;
DEALLOCATE PREPARE opening_stmt;

SET @opening_date_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Accounts' AND column_name = 'OpeningBalanceDate');
SET @opening_date_sql = IF(@opening_date_exists = 0, 'ALTER TABLE Accounts ADD COLUMN OpeningBalanceDate DATETIME NULL', 'SELECT 1');
PREPARE opening_date_stmt FROM @opening_date_sql;
EXECUTE opening_date_stmt;
DEALLOCATE PREPARE opening_date_stmt;

UPDATE Accounts
SET OpeningBalance = Balance,
    OpeningBalanceDate = COALESCE(CreatedAt, CURRENT_TIMESTAMP)
WHERE OpeningBalance = 0.00;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'Transactions' AND index_name = 'idx_transactions_account_date');
SET @index_sql = IF(@index_exists = 0, 'CREATE INDEX idx_transactions_account_date ON Transactions (AccountID, TransactionDate)', 'SELECT 1');
PREPARE index_stmt FROM @index_sql;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

INSERT IGNORE INTO SchemaMigrations (MigrationID)
VALUES ('001_add_opening_balance');
