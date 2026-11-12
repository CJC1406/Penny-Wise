from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.sql import func

from database import Base


class Transfer(Base):
    __tablename__ = "Transfers"
    TransferID = Column(Integer, primary_key=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    SourceAccountID = Column(Integer, ForeignKey("Accounts.AccountID"), nullable=False)
    DestinationAccountID = Column(Integer, ForeignKey("Accounts.AccountID"), nullable=False)
    Amount = Column(Numeric(12, 2), nullable=False)
    Description = Column(String(255))
    TransferDate = Column(DateTime, server_default=func.current_timestamp())
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())


class AccountBalanceSnapshot(Base):
    __tablename__ = "AccountBalanceSnapshots"
    SnapshotID = Column(Integer, primary_key=True)
    AccountID = Column(Integer, ForeignKey("Accounts.AccountID"), nullable=False)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    SnapshotMonth = Column(Date, nullable=False)
    OpeningBalance = Column(Numeric(12, 2), nullable=False)
    ExpectedBalance = Column(Numeric(12, 2), nullable=False)
    ActualBalance = Column(Numeric(12, 2), nullable=False)
    Difference = Column(Numeric(12, 2), nullable=False)
    ReconciledAt = Column(DateTime)


class AuditLog(Base):
    __tablename__ = "AuditLogs"
    AuditID = Column(Integer, primary_key=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"))
    OperationType = Column(String(30), nullable=False)
    TableName = Column(String(64), nullable=False)
    RecordID = Column(String(64), nullable=False)
    OldValue = Column(JSON)
    NewValue = Column(JSON)
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())


class SavingsGoal(Base):
    __tablename__ = "SavingsGoals"
    GoalID = Column(Integer, primary_key=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    GoalName = Column(String(100), nullable=False)
    TargetAmount = Column(Numeric(12, 2), nullable=False)
    CurrentAmount = Column(Numeric(12, 2), nullable=False, default=0)
    Deadline = Column(Date)
    Status = Column(Enum("ACTIVE", "COMPLETED", "ARCHIVED"), nullable=False, default="ACTIVE")
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())


class GoalContribution(Base):
    __tablename__ = "GoalContributions"
    ContributionID = Column(Integer, primary_key=True)
    GoalID = Column(Integer, ForeignKey("SavingsGoals.GoalID"), nullable=False)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    Amount = Column(Numeric(12, 2), nullable=False)
    ContributionDate = Column(DateTime, server_default=func.current_timestamp())
    Note = Column(String(255))


class RecurringTransaction(Base):
    __tablename__ = "RecurringTransactions"
    RecurringTransactionID = Column(Integer, primary_key=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    AccountID = Column(Integer, ForeignKey("Accounts.AccountID"), nullable=False)
    CategoryID = Column(Integer, ForeignKey("Categories.CategoryID"), nullable=False)
    Amount = Column(Numeric(12, 2), nullable=False)
    TransactionType = Column(Enum("INCOME", "EXPENSE"), nullable=False)
    Frequency = Column(Enum("WEEKLY", "MONTHLY", "YEARLY"), nullable=False)
    NextExecutionDate = Column(Date, nullable=False)
    Description = Column(String(255))
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())


class RecurringTransactionExecution(Base):
    __tablename__ = "RecurringTransactionExecutions"
    ExecutionID = Column(Integer, primary_key=True)
    RecurringTransactionID = Column(Integer, ForeignKey("RecurringTransactions.RecurringTransactionID"), nullable=False)
    TransactionID = Column(Integer, ForeignKey("Transactions.TransactionID"))
    ScheduledDate = Column(Date, nullable=False)
    ExecutedAt = Column(DateTime)
    Status = Column(Enum("PENDING", "EXECUTED", "FAILED", "SKIPPED"), nullable=False, default="PENDING")
    ErrorMessage = Column(String(255))


class TransactionAttachment(Base):
    __tablename__ = "TransactionAttachments"
    AttachmentID = Column(Integer, primary_key=True)
    TransactionID = Column(Integer, ForeignKey("Transactions.TransactionID"), nullable=False)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    FileName = Column(String(255), nullable=False)
    StorageKey = Column(String(500), nullable=False)
    MimeType = Column(String(100))
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())
