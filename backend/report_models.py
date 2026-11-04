from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.sql import func

from database import Base


class Report(Base):
    __tablename__ = "Reports"

    ReportID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    ReportName = Column(String(100), nullable=False)
    ReportType = Column(String(50), nullable=False)
    GeneratedAt = Column(DateTime, server_default=func.current_timestamp())
    ReportParameters = Column(JSON)
