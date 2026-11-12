-- Reporting views and transactional procedures for the DBMS workstream.
-- Apply after 002_finance_extensions.sql.

CREATE OR REPLACE VIEW vw_user_account_balances AS
SELECT a.UserID, a.AccountID, a.AccountName, a.AccountType, a.Balance, a.Currency
FROM Accounts a
WHERE a.IsActive = 1;

CREATE OR REPLACE VIEW vw_monthly_income_expenses AS
SELECT a.UserID,
       DATE_FORMAT(t.TransactionDate, '%Y-%m-01') AS MonthStart,
       SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE 0 END) AS TotalIncome,
       SUM(CASE WHEN t.TransactionType = 'EXPENSE' THEN t.Amount ELSE 0 END) AS TotalExpenses
FROM Transactions t
JOIN Accounts a ON a.AccountID = t.AccountID
GROUP BY a.UserID, DATE_FORMAT(t.TransactionDate, '%Y-%m-01');

CREATE OR REPLACE VIEW vw_category_expenses AS
SELECT a.UserID, c.CategoryID, c.CategoryName,
       DATE_FORMAT(t.TransactionDate, '%Y-%m-01') AS MonthStart,
       SUM(t.Amount) AS TotalExpenses
FROM Transactions t
JOIN Accounts a ON a.AccountID = t.AccountID
JOIN Categories c ON c.CategoryID = t.CategoryID
WHERE t.TransactionType = 'EXPENSE'
GROUP BY a.UserID, c.CategoryID, c.CategoryName,
         DATE_FORMAT(t.TransactionDate, '%Y-%m-01');

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_get_monthly_summary$$
CREATE PROCEDURE sp_get_monthly_summary(IN p_user_id INT, IN p_month DATE)
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE 0 END), 0) AS TotalIncome,
    COALESCE(SUM(CASE WHEN t.TransactionType = 'EXPENSE' THEN t.Amount ELSE 0 END), 0) AS TotalExpenses,
    COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0) AS NetSavings
  FROM Transactions t
  JOIN Accounts a ON a.AccountID = t.AccountID
  WHERE a.UserID = p_user_id
    AND t.TransactionDate >= p_month
    AND t.TransactionDate < DATE_ADD(p_month, INTERVAL 1 MONTH);
END$$

DROP PROCEDURE IF EXISTS sp_reconcile_account_balance$$
CREATE PROCEDURE sp_reconcile_account_balance(IN p_account_id INT, IN p_user_id INT, IN p_month DATE)
BEGIN
  INSERT INTO AccountBalanceSnapshots
    (AccountID, UserID, SnapshotMonth, OpeningBalance, ExpectedBalance, ActualBalance, Difference, ReconciledAt)
  SELECT a.AccountID, a.UserID, p_month, a.OpeningBalance,
    a.OpeningBalance + COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0),
    a.Balance,
    a.Balance - (a.OpeningBalance + COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0)),
    CASE WHEN a.Balance = a.OpeningBalance + COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0) THEN CURRENT_TIMESTAMP ELSE NULL END
  FROM Accounts a
  LEFT JOIN Transactions t ON t.AccountID = a.AccountID
  WHERE a.AccountID = p_account_id AND a.UserID = p_user_id
  GROUP BY a.AccountID, a.UserID, p_month, a.OpeningBalance, a.Balance
  ON DUPLICATE KEY UPDATE
    ExpectedBalance = VALUES(ExpectedBalance), ActualBalance = VALUES(ActualBalance),
    Difference = VALUES(Difference), ReconciledAt = VALUES(ReconciledAt);
  SELECT * FROM AccountBalanceSnapshots WHERE AccountID = p_account_id AND SnapshotMonth = p_month;
END$$

DELIMITER ;

INSERT IGNORE INTO SchemaMigrations (MigrationID)
VALUES ('003_views_and_procedures');
