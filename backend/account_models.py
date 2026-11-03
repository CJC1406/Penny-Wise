from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from database import Base


class Account(Base):
    __tablename__ = "Accounts"

    AccountID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    AccountName = Column(String(100), nullable=False)
    AccountType = Column(String(30), nullable=False)
    Balance = Column(Numeric(12, 2), default=0)
    Currency = Column(String(10), default="INR")
    IsActive = Column(Boolean, default=True)
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())
