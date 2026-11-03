from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Enum
)
from sqlalchemy.sql import func

from database import Base


class Budget(Base):
    __tablename__ = "Budgets"

    BudgetID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    CategoryID = Column(
        Integer,
        ForeignKey("Categories.CategoryID"),
        nullable=False
    )
    BudgetAmount = Column(Numeric(12, 2), nullable=False)
    BudgetPeriod = Column(
        Enum("WEEKLY", "MONTHLY", "YEARLY"),
        default="MONTHLY"
    )
    StartDate = Column(Date, nullable=False)
    EndDate = Column(Date, nullable=False)
    CreatedAt = Column(
        DateTime,
        server_default=func.current_timestamp()
    )
