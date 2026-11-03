from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from database import Base


class Notification(Base):
    __tablename__ = "Notifications"

    NotificationID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    NotificationType = Column(String(50), nullable=False)
    Message = Column(String(255), nullable=False)
    IsRead = Column(Boolean, default=False)
    CreatedAt = Column(
        DateTime,
        server_default=func.current_timestamp()
    )
