
import os
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from jose import jwt, JWTError

import models
import account_models
import category_models
import transaction_models
import budget_models
import notification_models
import report_models

from database import SessionLocal


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="PennyWise API",
    description="Personal Finance Management System",
    version="1.0.0"
)

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing. Check backend/.env")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

password_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# --------------------------------------------------
# DATABASE SESSION
# --------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class RegisterRequest(BaseModel):
    Username: str
    Email: str
    FullName: str
    Password: str
    Phone: str | None = None


class LoginRequest(BaseModel):
    Username: str
    Password: str


# --------------------------------------------------
# AUTHENTICATION FUNCTIONS
# --------------------------------------------------

def hash_password(password: str):
    return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    try:
        return password_context.verify(
            plain_password,
            hashed_password
        )
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = int(payload.get("sub"))

    except (JWTError, ValueError, TypeError):
        raise credentials_error

    user = db.query(models.User).filter(
        models.User.UserID == user_id
    ).first()

    if user is None:
        raise credentials_error

    return user


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to PennyWise API",
        "version": "1.0.0"
    }


# --------------------------------------------------
# DATABASE HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health(db: Session = Depends(get_db)):
    database = db.execute(
        text("SELECT DATABASE()")
    ).scalar()

    return {
        "status": "connected",
        "database": database.lower() if database else None
    }


# --------------------------------------------------
# USER REGISTRATION
# --------------------------------------------------

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    if len(request.Password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters"
        )

    existing_user = db.query(models.User).filter(
        (models.User.Username == request.Username) |
        (models.User.Email == request.Email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists"
        )

    user = models.User(
        Username=request.Username,
        Email=request.Email,
        FullName=request.FullName,
        Phone=request.Phone,
        PasswordHash=hash_password(request.Password)
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists"
        )

    return {
        "message": "User registered successfully",
        "UserID": user.UserID,
        "Username": user.Username,
        "Email": user.Email
    }


# --------------------------------------------------
# USER LOGIN
# --------------------------------------------------


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        (models.User.Username == form_data.username) |
        (models.User.Email == form_data.username)
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.PasswordHash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password"
        )

    user.LastLogin = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(user.UserID)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "UserID": user.UserID,
            "Username": user.Username,
            "Email": user.Email,
            "FullName": user.FullName
        }
    }

# --------------------------------------------------
# GET CURRENT USER PROFILE
# --------------------------------------------------

@app.get("/users")
def get_users(
    current_user: models.User = Depends(get_current_user)
):
    return [{
        "UserID": current_user.UserID,
        "Username": current_user.Username,
        "Email": current_user.Email,
        "FullName": current_user.FullName,
        "Phone": current_user.Phone,
        "CreatedAt": current_user.CreatedAt,
        "LastLogin": current_user.LastLogin
    }]


# --------------------------------------------------
# GET ACCOUNTS
# --------------------------------------------------

@app.get("/accounts")
def get_accounts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    accounts = db.query(account_models.Account).filter(
        account_models.Account.UserID == current_user.UserID
    ).all()

    return [
        {
            "AccountID": a.AccountID,
            "UserID": a.UserID,
            "AccountName": a.AccountName,
            "AccountType": a.AccountType,
            "Balance": a.Balance,
            "Currency": a.Currency,
            "IsActive": a.IsActive,
            "CreatedAt": a.CreatedAt
        }
        for a in accounts
    ]


# --------------------------------------------------
# GET CATEGORIES
# --------------------------------------------------

@app.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    categories = db.query(category_models.Category).filter(
        category_models.Category.UserID == current_user.UserID
    ).all()

    return [
        {
            "CategoryID": c.CategoryID,
            "UserID": c.UserID,
            "ParentCategoryID": c.ParentCategoryID,
            "CategoryName": c.CategoryName,
            "CategoryType": c.CategoryType,
            "IconCode": c.IconCode,
            "IsSystemDefault": c.IsSystemDefault
        }
        for c in categories
    ]


# --------------------------------------------------
# GET TRANSACTIONS
# --------------------------------------------------

@app.get("/transactions")
def get_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    results = (
        db.query(
            transaction_models.Transaction,
            account_models.Account.AccountName,
            category_models.Category.CategoryName
        )
        .join(
            account_models.Account,
            transaction_models.Transaction.AccountID
            == account_models.Account.AccountID
        )
        .join(
            category_models.Category,
            transaction_models.Transaction.CategoryID
            == category_models.Category.CategoryID
        )
        .filter(
            account_models.Account.UserID == current_user.UserID,
            category_models.Category.UserID == current_user.UserID
        )
        .all()
    )

    return [
        {
            "TransactionID": t.TransactionID,
            "AccountID": t.AccountID,
            "AccountName": account_name,
            "CategoryID": t.CategoryID,
            "CategoryName": category_name,
            "Amount": t.Amount,
            "TransactionType": t.TransactionType,
            "Description": t.Description,
            "TransactionDate": t.TransactionDate,
            "PaymentMethod": t.PaymentMethod,
            "Merchant": t.Merchant
        }
        for t, account_name, category_name in results
    ]


# --------------------------------------------------
# GET BUDGETS
# --------------------------------------------------

@app.get("/budgets")
def get_budgets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    results = (
        db.query(
            budget_models.Budget,
            category_models.Category.CategoryName
        )
        .join(
            category_models.Category,
            budget_models.Budget.CategoryID
            == category_models.Category.CategoryID
        )
        .filter(
            budget_models.Budget.UserID == current_user.UserID,
            category_models.Category.UserID == current_user.UserID
        )
        .all()
    )

    return [
        {
            "BudgetID": b.BudgetID,
            "UserID": b.UserID,
            "CategoryID": b.CategoryID,
            "CategoryName": category_name,
            "BudgetAmount": b.BudgetAmount,
            "BudgetPeriod": b.BudgetPeriod,
            "StartDate": b.StartDate,
            "EndDate": b.EndDate,
            "CreatedAt": b.CreatedAt
        }
        for b, category_name in results
    ]


# --------------------------------------------------
# GET NOTIFICATIONS
# --------------------------------------------------

@app.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notifications = db.query(
        notification_models.Notification
    ).filter(
        notification_models.Notification.UserID == current_user.UserID
    ).all()

    return [
        {
            "NotificationID": n.NotificationID,
            "UserID": n.UserID,
            "NotificationType": n.NotificationType,
            "Message": n.Message,
            "IsRead": n.IsRead,
            "CreatedAt": n.CreatedAt
        }
        for n in notifications
    ]


# --------------------------------------------------
# GET REPORTS
# --------------------------------------------------

@app.get("/reports")
def get_reports(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reports = db.query(report_models.Report).filter(
        report_models.Report.UserID == current_user.UserID
    ).all()

    return [
        {
            "ReportID": r.ReportID,
            "UserID": r.UserID,
            "ReportName": r.ReportName,
            "ReportType": r.ReportType,
            "GeneratedAt": r.GeneratedAt,
            "ReportParameters": r.ReportParameters
        }
        for r in reports
    ]
