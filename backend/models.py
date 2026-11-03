from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "Users"

    UserID = Column(Integer, primary_key=True, index=True)
    Username = Column(String(50), unique=True, nullable=False)
    Email = Column(String(100), unique=True, nullable=False)
    PasswordHash = Column(String(255), nullable=False)
    FullName = Column(String(100), nullable=False)
    Phone = Column(String(15))
    CreatedAt = Column(DateTime, server_default=func.current_timestamp())
    LastLogin = Column(DateTime)
