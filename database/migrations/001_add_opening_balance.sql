-- Additive migration. Run this against the existing PersonalFinanceDB after a backup.
-- It preserves every existing row and records the current balance as the opening
-- baseline for the ledger going forward; it does not recreate or drop tables.
ALTER TABLE Accounts
  ADD COLUMN OpeningBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN OpeningBalanceDate DATETIME NULL;

UPDATE Accounts
SET OpeningBalance = Balance,
    OpeningBalanceDate = COALESCE(CreatedAt, CURRENT_TIMESTAMP)
WHERE OpeningBalance = 0.00;

CREATE INDEX idx_transactions_account_date
  ON Transactions (AccountID, TransactionDate);
