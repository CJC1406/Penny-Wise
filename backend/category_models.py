from sqlalchemy import Column, Integer, String, Boolean, ForeignKey

from database import Base


class Category(Base):
    __tablename__ = "Categories"

    CategoryID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    ParentCategoryID = Column(
        Integer,
        ForeignKey("Categories.CategoryID"),
        nullable=True
    )
    CategoryName = Column(String(100), nullable=False)
    CategoryType = Column(String(20), nullable=False)
    IconCode = Column(String(50))
    IsSystemDefault = Column(Boolean, default=False)

