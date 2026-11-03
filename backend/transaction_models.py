from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    Enum
)
from sqlalchemy.sql import func

from database import Base


class Transaction(Base):
    __tablename__ = "Transactions"

    TransactionID = Column(Integer, primary_key=True, index=True)
    AccountID = Column(
        Integer,
        ForeignKey("Accounts.AccountID"),
        nullable=False
    )
    CategoryID = Column(
        Integer,
        ForeignKey("Categories.CategoryID"),
        nullable=False
    )
    Amount = Column(Numeric(12, 2), nullable=False)
    TransactionType = Column(
        Enum("INCOME", "EXPENSE"),
        nullable=False
    )
    Description = Column(String(255))
    TransactionDate = Column(
        DateTime,
        server_default=func.current_timestamp()
    )
    PaymentMethod = Column(String(50))
    Merchant = Column(String(100))
