# PennyWise MySQL ER diagram

```mermaid
erDiagram
    Users ||--o{ Accounts : owns
    Users ||--o{ Categories : creates
    Categories ||--o{ Categories : contains
    Accounts ||--o{ Transactions : records
    Categories ||--o{ Transactions : classifies
    Users ||--o{ Budgets : sets
    Categories ||--o{ Budgets : limits
    Users ||--o{ Notifications : receives
    Users ||--o{ Reports : generates
    Users ||--o{ Transfers : initiates
    Accounts ||--o{ Transfers : source
    Accounts ||--o{ Transfers : destination
    Users ||--o{ AccountBalanceSnapshots : owns
    Accounts ||--o{ AccountBalanceSnapshots : snapshots
    Users ||--o{ AuditLogs : creates
    Users ||--o{ SavingsGoals : defines
    SavingsGoals ||--o{ GoalContributions : receives
    Users ||--o{ GoalContributions : makes
    Users ||--o{ RecurringTransactions : schedules
    Accounts ||--o{ RecurringTransactions : uses
    Categories ||--o{ RecurringTransactions : classifies
    RecurringTransactions ||--o{ RecurringTransactionExecutions : runs
    Transactions ||--o{ RecurringTransactionExecutions : creates
    Users ||--o{ TransactionAttachments : owns
    Transactions ||--o{ TransactionAttachments : has

    Users {
        int UserID PK
        varchar Username UK
        varchar Email UK
        varchar PasswordHash
        varchar FullName
        varchar Phone
        datetime CreatedAt
        datetime LastLogin
    }
    Accounts {
        int AccountID PK
        int UserID FK
        varchar AccountName
        varchar AccountType
        decimal Balance
        varchar Currency
        boolean IsActive
        datetime CreatedAt
    }
    Categories {
        int CategoryID PK
        int UserID FK
        int ParentCategoryID FK
        varchar CategoryName
        varchar CategoryType
        varchar IconCode
        boolean IsSystemDefault
    }
    Transactions {
        int TransactionID PK
        int AccountID FK
        int CategoryID FK
        decimal Amount
        enum TransactionType
        varchar Description
        datetime TransactionDate
        varchar PaymentMethod
        varchar Merchant
    }
    Budgets {
        int BudgetID PK
        int UserID FK
        int CategoryID FK
        decimal BudgetAmount
        enum BudgetPeriod
        date StartDate
        date EndDate
        datetime CreatedAt
    }
    Notifications {
        int NotificationID PK
        int UserID FK
        varchar NotificationType
        varchar Message
        boolean IsRead
        datetime CreatedAt
    }
    Reports {
        int ReportID PK
        int UserID FK
        varchar ReportName
        varchar ReportType
        datetime GeneratedAt
        json ReportParameters
    }
    Transfers {
        int TransferID PK
        int UserID FK
        int SourceAccountID FK
        int DestinationAccountID FK
        decimal Amount
        varchar Description
        datetime TransferDate
        datetime CreatedAt
    }
    AccountBalanceSnapshots {
        int SnapshotID PK
        int AccountID FK
        int UserID FK
        date SnapshotMonth
        decimal OpeningBalance
        decimal ExpectedBalance
        decimal ActualBalance
        decimal Difference
        datetime ReconciledAt
    }
    AuditLogs {
        int AuditID PK
        int UserID FK
        varchar OperationType
        varchar TableName
        varchar RecordID
        json OldValue
        json NewValue
        datetime CreatedAt
    }
    SavingsGoals {
        int GoalID PK
        int UserID FK
        varchar GoalName
        decimal TargetAmount
        decimal CurrentAmount
        date Deadline
        enum Status
        datetime CreatedAt
    }
    GoalContributions {
        int ContributionID PK
        int GoalID FK
        int UserID FK
        decimal Amount
        datetime ContributionDate
        varchar Note
    }
    RecurringTransactions {
        int RecurringTransactionID PK
        int UserID FK
        int AccountID FK
        int CategoryID FK
        decimal Amount
        enum TransactionType
        enum Frequency
        date NextExecutionDate
        varchar Description
        boolean IsActive
        datetime CreatedAt
    }
    RecurringTransactionExecutions {
        int ExecutionID PK
        int RecurringTransactionID FK
        int TransactionID FK
        date ScheduledDate
        datetime ExecutedAt
        enum Status
        varchar ErrorMessage
    }
    TransactionAttachments {
        int AttachmentID PK
        int TransactionID FK
        int UserID FK
        varchar FileName
        varchar StorageKey
        varchar MimeType
        datetime CreatedAt
    }
```

`Reports.ReportParameters`, `AuditLogs.OldValue`, and `AuditLogs.NewValue` are JSON columns inside MySQL for flexible metadata; they do not replace the relational model.
