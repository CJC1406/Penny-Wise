
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_

from database import get_db
from models import User
from account_models import Account
from category_models import Category
from transaction_models import Transaction
from budget_models import Budget
from notification_models import Notification
from report_models import Report
from finance_extension_models import Transfer
from finance_extension_models import SavingsGoal, GoalContribution, RecurringTransaction
from mongo_store import mongo_enabled, upsert_transaction, delete_transaction as mongo_delete_transaction
from mongo_store import add_notification as mongo_add_notification, list_notifications as mongo_list_notifications
from mongo_store import mark_notification_read as mongo_mark_notification_read, search_transactions as mongo_search_transactions


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing from backend/.env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI(
    title="PennyWise API",
    description="Personal Finance Management System",
    version="1.0.0"
)

password_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# --------------------------------------------------
# DATABASE DEPENDENCY
# --------------------------------------------------

def get_database():
    db = next(get_db())
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
    Phone: Optional[str] = None


class AccountCreate(BaseModel):
    AccountName: str
    AccountType: str
    Currency: str = "INR"


class AccountUpdate(BaseModel):
    AccountName: Optional[str] = None
    AccountType: Optional[str] = None
    Currency: Optional[str] = None


class TransactionCreate(BaseModel):
    AccountID: int
    CategoryID: int
    Amount: Decimal = Field(gt=0)
    TransactionType: str
    Description: Optional[str] = None
    TransactionDate: Optional[datetime] = None
    PaymentMethod: Optional[str] = None
    Merchant: Optional[str] = None


class TransactionUpdate(BaseModel):
    AccountID: Optional[int] = None
    CategoryID: Optional[int] = None
    Amount: Optional[Decimal] = Field(default=None, gt=0)
    TransactionType: Optional[str] = None
    Description: Optional[str] = None
    TransactionDate: Optional[datetime] = None
    PaymentMethod: Optional[str] = None
    Merchant: Optional[str] = None


class TransferCreate(BaseModel):
    SourceAccountID: int
    DestinationAccountID: int
    Amount: Decimal = Field(gt=0)
    Description: Optional[str] = None
    TransferDate: Optional[datetime] = None


class BudgetCreate(BaseModel):
    CategoryID: int
    BudgetAmount: Decimal = Field(gt=0)
    BudgetPeriod: str = "MONTHLY"
    StartDate: date
    EndDate: date


class SavingsGoalCreate(BaseModel):
    GoalName: str
    TargetAmount: Decimal = Field(gt=0)
    Deadline: Optional[date] = None


class GoalContributionCreate(BaseModel):
    Amount: Decimal = Field(gt=0)
    Note: Optional[str] = None


class RecurringTransactionCreate(BaseModel):
    AccountID: int
    CategoryID: int
    Amount: Decimal = Field(gt=0)
    TransactionType: str
    Frequency: str = "MONTHLY"
    NextExecutionDate: date
    Description: Optional[str] = None


class TransactionSearchParams(BaseModel):
    CategoryID: Optional[int] = None
    AccountID: Optional[int] = None
    TransactionType: Optional[str] = None
    StartDate: Optional[datetime] = None
    EndDate: Optional[datetime] = None
    MinAmount: Optional[Decimal] = Field(default=None, ge=0)
    MaxAmount: Optional[Decimal] = Field(default=None, ge=0)


# --------------------------------------------------
# PASSWORD FUNCTIONS
# --------------------------------------------------

def hash_password(password: str):
    return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    try:
        return password_context.verify(plain_password, hashed_password)
    except Exception:
        return False


# --------------------------------------------------
# JWT TOKEN FUNCTIONS
# --------------------------------------------------

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
        algorithm=ALGORITHM
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_database)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        user_id = int(user_id)

    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    user = db.query(User).filter(
        User.UserID == user_id
    ).first()

    if user is None:
        raise credentials_exception

    return user


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def get_owned_account(db, account_id, user_id):
    account = db.query(Account).filter(
        Account.AccountID == account_id,
        Account.UserID == user_id,
        Account.IsActive == True
    ).with_for_update().first()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Active account not found"
        )

    return account


def get_owned_category(db, category_id, user_id, transaction_type):
    category = db.query(Category).filter(
        Category.CategoryID == category_id,
        Category.UserID == user_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found"
        )

    if category.CategoryType.upper() != transaction_type:
        raise HTTPException(
            status_code=400,
            detail="Category type must match transaction type"
        )

    return category


def balance_effect(amount, transaction_type):
    if transaction_type == "INCOME":
        return amount
    return -amount


def transaction_response(transaction):
    return {
        "TransactionID": transaction.TransactionID,
        "AccountID": transaction.AccountID,
        "CategoryID": transaction.CategoryID,
        "Amount": transaction.Amount,
        "TransactionType": transaction.TransactionType,
        "Description": transaction.Description,
        "TransactionDate": transaction.TransactionDate,
        "PaymentMethod": transaction.PaymentMethod,
        "Merchant": transaction.Merchant
    }


def create_budget_alerts(db, user_id, category_id, transaction_date):
    """Create one alert per threshold for the active budget period."""
    budgets = db.query(Budget).filter(
        Budget.UserID == user_id,
        Budget.CategoryID == category_id,
        Budget.StartDate <= transaction_date.date(),
        Budget.EndDate >= transaction_date.date(),
    ).all()
    category = db.query(Category).filter(Category.CategoryID == category_id).first()
    for budget in budgets:
        spent = db.query(func.coalesce(func.sum(Transaction.Amount), 0)).join(
            Account, Transaction.AccountID == Account.AccountID
        ).filter(
            Account.UserID == user_id,
            Transaction.CategoryID == category_id,
            Transaction.TransactionType == "EXPENSE",
            Transaction.TransactionDate >= budget.StartDate,
            Transaction.TransactionDate < datetime.combine(budget.EndDate, datetime.max.time()),
        ).scalar()
        spent = Decimal(str(spent or 0))
        budget_amount = Decimal(str(budget.BudgetAmount))
        ratio = spent / budget_amount if budget_amount else Decimal("0")
        for threshold, cutoff in ((75, Decimal("0.75")), (90, Decimal("0.9")), (100, Decimal("1"))):
            if ratio < cutoff:
                continue
            existing = db.query(Notification).filter(
                Notification.UserID == user_id,
                Notification.NotificationType == f"BUDGET_{threshold}",
                Notification.Message.like(f"%{category.CategoryName}%"),
                Notification.CreatedAt >= datetime.combine(budget.StartDate, datetime.min.time()),
            ).first()
            if not existing:
                over = max(spent - budget_amount, Decimal("0"))
                message = (f"You have exceeded your {category.CategoryName} budget by ₹{over:.2f}." if threshold == 100
                           else f"You have used {spent / budget_amount:.0%} of your {category.CategoryName} budget.")
                if not mongo_add_notification(user_id, f"BUDGET_{threshold}", category.CategoryName, budget, spent, message):
                    db.add(Notification(UserID=user_id, NotificationType=f"BUDGET_{threshold}", Message=message, IsRead=False))


# --------------------------------------------------
# GENERAL ROUTES
# --------------------------------------------------

@app.get("/")
def home():
    return {"message": "Welcome to PennyWise API"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "application": "PennyWise"
    }


# --------------------------------------------------
# USER REGISTRATION
# --------------------------------------------------

@app.post("/register")
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_database)
):
    if len(user_data.Password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters"
        )

    existing_user = db.query(User).filter(
        (User.Username == user_data.Username) |
        (User.Email == user_data.Email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists"
        )

    new_user = User(
        Username=user_data.Username,
        Email=user_data.Email,
        FullName=user_data.FullName,
        PasswordHash=hash_password(user_data.Password),
        Phone=user_data.Phone
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Provision only transaction categories for a new user; financial accounts
    # remain empty and therefore start at a zero total balance.
    db.add_all([
        Category(UserID=new_user.UserID, CategoryName="General", CategoryType="EXPENSE", IsSystemDefault=True),
        Category(UserID=new_user.UserID, CategoryName="Income", CategoryType="INCOME", IsSystemDefault=True),
    ])
    db.commit()

    return {
        "message": "Registration successful",
        "UserID": new_user.UserID,
        "Username": new_user.Username,
        "account_count": 0,
        "total_balance": Decimal("0.00")
    }


# --------------------------------------------------
# USER LOGIN
# --------------------------------------------------

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_database)
):
    user = db.query(User).filter(
        User.Username == form_data.username
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.PasswordHash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user.LastLogin = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(user.UserID)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# --------------------------------------------------
# USER PROFILE
# --------------------------------------------------

@app.get("/users")
def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "UserID": current_user.UserID,
        "Username": current_user.Username,
        "Email": current_user.Email,
        "FullName": current_user.FullName,
        "Phone": current_user.Phone,
        "CreatedAt": current_user.CreatedAt
    }


# --------------------------------------------------
# ACCOUNT MANAGEMENT
# --------------------------------------------------

@app.get("/accounts")
def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    return db.query(Account).filter(
        Account.UserID == current_user.UserID,
        Account.IsActive == True
    ).all()


@app.post("/accounts", status_code=201)
def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    new_account = Account(
        UserID=current_user.UserID,
        AccountName=account_data.AccountName,
        AccountType=account_data.AccountType,
        Balance=Decimal("0.00"),
        Currency=account_data.Currency,
        IsActive=True
    )

    try:
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not create account"
        )

    return {
        "message": "Account created successfully",
        "account": new_account
    }


@app.put("/accounts/{account_id}")
def update_account(
    account_id: int,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    account = db.query(Account).filter(
        Account.AccountID == account_id,
        Account.UserID == current_user.UserID,
        Account.IsActive == True
    ).first()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Account not found"
        )

    updates = account_data.dict(exclude_unset=True)

    for field, value in updates.items():
        setattr(account, field, value)

    try:
        db.commit()
        db.refresh(account)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update account"
        )

    return {
        "message": "Account updated successfully",
        "account": account
    }


@app.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    account = db.query(Account).filter(
        Account.AccountID == account_id,
        Account.UserID == current_user.UserID,
        Account.IsActive == True
    ).first()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Account not found"
        )

    account.IsActive = False
    db.commit()

    return {"message": "Account deactivated successfully"}


# --------------------------------------------------
# CATEGORY MANAGEMENT
# --------------------------------------------------

@app.get("/categories")
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    return db.query(Category).filter(
        Category.UserID == current_user.UserID
    ).all()

class CategoryCreate(BaseModel):
    CategoryName: str
    CategoryType: str
    IconCode: Optional[str] = None


@app.post("/categories", status_code=201)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    category_type = data.CategoryType.upper()

    if category_type not in ["INCOME", "EXPENSE"]:
        raise HTTPException(
            status_code=400,
            detail="CategoryType must be INCOME or EXPENSE"
        )

    category = Category(
        UserID=current_user.UserID,
        CategoryName=data.CategoryName,
        CategoryType=category_type,
        IconCode=data.IconCode,
        IsSystemDefault=False
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return {
        "CategoryID": category.CategoryID,
        "CategoryName": category.CategoryName,
        "CategoryType": category.CategoryType,
        "IconCode": category.IconCode
    }
# --------------------------------------------------
# TRANSACTION MANAGEMENT
# --------------------------------------------------

@app.get("/transactions")
def get_transactions(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    filters = {"category_id": category_id, "account_id": account_id, "transaction_type": transaction_type.upper() if transaction_type else None, "start_date": start_date, "end_date": end_date, "min_amount": min_amount, "max_amount": max_amount, "text": search}
    if any(value is not None for value in filters.values()) and mongo_enabled():
        seed_rows = (db.query(Transaction, Category, Account)
                     .join(Account, Transaction.AccountID == Account.AccountID)
                     .join(Category, Transaction.CategoryID == Category.CategoryID)
                     .filter(Account.UserID == current_user.UserID, Category.UserID == current_user.UserID)
                     .all())
        for transaction, category, account in seed_rows:
            upsert_transaction(transaction, current_user.UserID, category.CategoryName, account.AccountName)
        rows = mongo_search_transactions(current_user.UserID, filters)
        if rows is not None:
            return {"transactions": rows, "total": sum(row["amount"] for row in rows if row["transaction_type"] == "EXPENSE"), "count": len(rows)}
    query = (
        db.query(Transaction)
        .join(
            Account,
            Transaction.AccountID == Account.AccountID
        )
        .join(
            Category,
            Transaction.CategoryID == Category.CategoryID
        )
        .filter(
            Account.UserID == current_user.UserID,
            Category.UserID == current_user.UserID
        )
    )
    if category_id is not None: query = query.filter(Transaction.CategoryID == category_id)
    if account_id is not None: query = query.filter(Transaction.AccountID == account_id)
    if transaction_type: query = query.filter(Transaction.TransactionType == transaction_type.upper())
    if search: query = query.filter((Transaction.Description.like(f"%{search}%")) | (Transaction.Merchant.like(f"%{search}%")))
    if start_date: query = query.filter(Transaction.TransactionDate >= start_date)
    if end_date: query = query.filter(Transaction.TransactionDate <= end_date)
    if min_amount is not None: query = query.filter(Transaction.Amount >= min_amount)
    if max_amount is not None: query = query.filter(Transaction.Amount <= max_amount)
    items = query.order_by(Transaction.TransactionDate.desc()).all()
    return {"transactions": items, "total": sum((Decimal(str(t.Amount)) for t in items if t.TransactionType == "EXPENSE"), Decimal("0")), "count": len(items)} if any(v is not None for v in filters.values()) else items


@app.get("/summary")
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    accounts = db.query(Account).filter(Account.UserID == current_user.UserID, Account.IsActive == True).all()
    transactions = (db.query(Transaction).join(Account, Transaction.AccountID == Account.AccountID)
        .filter(Account.UserID == current_user.UserID).all())
    income = sum((Decimal(str(t.Amount)) for t in transactions if t.TransactionType == "INCOME"), Decimal("0"))
    expenses = sum((Decimal(str(t.Amount)) for t in transactions if t.TransactionType == "EXPENSE"), Decimal("0"))
    balance = sum((Decimal(str(a.Balance or 0)) for a in accounts), Decimal("0"))
    return {"balance": balance, "income": income, "expenses": expenses, "accounts": len(accounts)}


@app.get("/reconciliation")
def get_reconciliation(month: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    try:
        month_date = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="month must use YYYY-MM format")
    query = text("""
        SELECT a.AccountID, a.AccountName, a.Balance AS ActualBalance,
               a.OpeningBalance,
               a.OpeningBalance + COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0) AS ExpectedBalance,
               a.Balance - (a.OpeningBalance + COALESCE(SUM(CASE WHEN t.TransactionType = 'INCOME' THEN t.Amount ELSE -t.Amount END), 0)) AS Difference
        FROM Accounts a
        LEFT JOIN Transactions t ON t.AccountID = a.AccountID
          AND t.TransactionDate < DATE_ADD(:month_start, INTERVAL 1 MONTH)
        WHERE a.UserID = :user_id AND a.IsActive = 1
        GROUP BY a.AccountID, a.AccountName, a.Balance, a.OpeningBalance
        ORDER BY a.AccountName
    """)
    try:
        rows = db.execute(query, {"month_start": month_date, "user_id": current_user.UserID}).mappings().all()
        return [dict(row) for row in rows]
    except Exception:
        raise HTTPException(status_code=500, detail="Apply the database migrations before using reconciliation")


@app.post("/transfers", status_code=201)
def create_transfer(
    transfer_data: TransferCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    if transfer_data.SourceAccountID == transfer_data.DestinationAccountID:
        raise HTTPException(status_code=400, detail="Source and destination accounts must differ")
    account_ids = sorted([transfer_data.SourceAccountID, transfer_data.DestinationAccountID])
    locked = db.query(Account).filter(
        Account.AccountID.in_(account_ids),
        Account.UserID == current_user.UserID,
        Account.IsActive == True
    ).order_by(Account.AccountID).with_for_update().all()
    if len(locked) != 2:
        raise HTTPException(status_code=404, detail="Both active accounts must belong to the current user")
    source = next(a for a in locked if a.AccountID == transfer_data.SourceAccountID)
    destination = next(a for a in locked if a.AccountID == transfer_data.DestinationAccountID)
    if Decimal(str(source.Balance or 0)) < transfer_data.Amount:
        raise HTTPException(status_code=400, detail="Insufficient account balance")
    source.Balance = Decimal(str(source.Balance or 0)) - transfer_data.Amount
    destination.Balance = Decimal(str(destination.Balance or 0)) + transfer_data.Amount
    transfer = Transfer(UserID=current_user.UserID, SourceAccountID=source.AccountID, DestinationAccountID=destination.AccountID, Amount=transfer_data.Amount, Description=transfer_data.Description)
    if transfer_data.TransferDate is not None:
        transfer.TransferDate = transfer_data.TransferDate
    try:
        db.add(transfer)
        db.commit()
        db.refresh(transfer)
        return {"TransferID": transfer.TransferID, "SourceAccountID": source.AccountID, "DestinationAccountID": destination.AccountID, "Amount": transfer.Amount, "source_balance": source.Balance, "destination_balance": destination.Balance}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not complete transfer")


@app.get("/accounts/{account_id}/reconciliation")
def reconcile_account(
    account_id: int,
    month: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    account = get_owned_account(db, account_id, current_user.UserID)
    try:
        row = db.execute(text("CALL sp_reconcile_account_balance(:account_id, :user_id, :month)"), {"account_id": account_id, "user_id": current_user.UserID, "month": month}).mappings().first()
        db.commit()
        return dict(row) if row else {"AccountID": account_id, "Difference": None}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Reconciliation requires the database migrations to be applied")


@app.post("/transactions", status_code=201)
def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    transaction_type = transaction_data.TransactionType.upper()

    if transaction_type not in ("INCOME", "EXPENSE"):
        raise HTTPException(
            status_code=400,
            detail="TransactionType must be INCOME or EXPENSE"
        )

    account = get_owned_account(
        db,
        transaction_data.AccountID,
        current_user.UserID
    )

    get_owned_category(
        db,
        transaction_data.CategoryID,
        current_user.UserID,
        transaction_type
    )

    new_transaction = Transaction(
        AccountID=account.AccountID,
        CategoryID=transaction_data.CategoryID,
        Amount=transaction_data.Amount,
        TransactionType=transaction_type,
        Description=transaction_data.Description,
        PaymentMethod=transaction_data.PaymentMethod,
        Merchant=transaction_data.Merchant
    )

    if transaction_data.TransactionDate is not None:
        new_transaction.TransactionDate = transaction_data.TransactionDate

    try:
        account.Balance = (
            Decimal(str(account.Balance or 0)) +
            balance_effect(transaction_data.Amount, transaction_type)
        )

        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)
        category = db.query(Category).filter(Category.CategoryID == new_transaction.CategoryID).first()
        upsert_transaction(new_transaction, current_user.UserID, category.CategoryName if category else None, account.AccountName)
        if transaction_type == "EXPENSE":
            create_budget_alerts(db, current_user.UserID, transaction_data.CategoryID, new_transaction.TransactionDate or datetime.now())
            db.commit()

        return {
            "message": "Transaction created successfully",
            "transaction": transaction_response(new_transaction),
            "updated_balance": account.Balance
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not create transaction"
        )


@app.put("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    transaction = (
        db.query(Transaction)
        .join(Account, Transaction.AccountID == Account.AccountID)
        .filter(
            Transaction.TransactionID == transaction_id,
            Account.UserID == current_user.UserID
        )
        .with_for_update()
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    updates = transaction_data.dict(exclude_unset=True)

    old_account = get_owned_account(
        db,
        transaction.AccountID,
        current_user.UserID
    )

    old_amount = Decimal(str(transaction.Amount))
    old_type = transaction.TransactionType

    new_account_id = updates.get("AccountID", transaction.AccountID)
    new_category_id = updates.get("CategoryID", transaction.CategoryID)
    new_amount = updates.get("Amount", transaction.Amount)
    new_type = updates.get(
        "TransactionType",
        transaction.TransactionType
    ).upper()

    if new_type not in ("INCOME", "EXPENSE"):
        raise HTTPException(
            status_code=400,
            detail="TransactionType must be INCOME or EXPENSE"
        )

    new_account = get_owned_account(
        db,
        new_account_id,
        current_user.UserID
    )

    get_owned_category(
        db,
        new_category_id,
        current_user.UserID,
        new_type
    )

    # Reverse the previous transaction effect.
    old_account.Balance = (
        Decimal(str(old_account.Balance or 0)) -
        balance_effect(old_amount, old_type)
    )

    # Apply the updated transaction effect.
    new_account.Balance = (
        Decimal(str(new_account.Balance or 0)) +
        balance_effect(Decimal(str(new_amount)), new_type)
    )

    for field, value in updates.items():
        setattr(transaction, field, value)

    transaction.TransactionType = new_type

    try:
        db.commit()
        db.refresh(transaction)
        category = db.query(Category).filter(Category.CategoryID == transaction.CategoryID).first()
        account = db.query(Account).filter(Account.AccountID == transaction.AccountID).first()
        upsert_transaction(transaction, current_user.UserID, category.CategoryName if category else None, account.AccountName if account else None)

        return {
            "message": "Transaction updated successfully",
            "transaction": transaction_response(transaction),
            "updated_balance": new_account.Balance
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update transaction"
        )


@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    transaction = (
        db.query(Transaction)
        .join(Account, Transaction.AccountID == Account.AccountID)
        .filter(
            Transaction.TransactionID == transaction_id,
            Account.UserID == current_user.UserID
        )
        .with_for_update()
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    account = get_owned_account(
        db,
        transaction.AccountID,
        current_user.UserID
    )

    # Reverse the transaction's balance effect.
    account.Balance = (
        Decimal(str(account.Balance or 0)) -
        balance_effect(
            Decimal(str(transaction.Amount)),
            transaction.TransactionType
        )
    )

    try:
        db.delete(transaction)
        db.commit()
        mongo_delete_transaction(transaction_id, current_user.UserID)

        return {
            "message": "Transaction deleted successfully",
            "updated_balance": account.Balance
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete transaction"
        )


# --------------------------------------------------
# BUDGET MANAGEMENT
# --------------------------------------------------

@app.get("/budgets")
def get_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    budgets = (db.query(Budget, Category.CategoryName)
               .join(Category, Budget.CategoryID == Category.CategoryID)
               .filter(Budget.UserID == current_user.UserID)
               .all())
    response = []
    for budget, category_name in budgets:
        spent = db.query(func.coalesce(func.sum(Transaction.Amount), 0)).join(
            Account, Transaction.AccountID == Account.AccountID
        ).filter(
            Account.UserID == current_user.UserID,
            Transaction.CategoryID == budget.CategoryID,
            Transaction.TransactionType == "EXPENSE",
            Transaction.TransactionDate >= budget.StartDate,
            Transaction.TransactionDate < datetime.combine(budget.EndDate, datetime.max.time()),
        ).scalar()
        response.append({
            "BudgetID": budget.BudgetID,
            "UserID": budget.UserID,
            "CategoryID": budget.CategoryID,
            "CategoryName": category_name,
            "BudgetAmount": budget.BudgetAmount,
            "BudgetPeriod": budget.BudgetPeriod,
            "StartDate": budget.StartDate,
            "EndDate": budget.EndDate,
            "Spent": Decimal(str(spent or 0)),
        })
        # Backfill an alert when a user opens Budgets after an expense was
        # recorded, including expenses created before alert monitoring existed.
        create_budget_alerts(db, current_user.UserID, budget.CategoryID, datetime.now())
    db.commit()
    return response


@app.post("/budgets", status_code=201)
def create_budget(data: BudgetCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    if data.BudgetPeriod.upper() not in ("WEEKLY", "MONTHLY", "YEARLY") or data.EndDate < data.StartDate:
        raise HTTPException(status_code=400, detail="Invalid budget period or dates")
    get_owned_category(db, data.CategoryID, current_user.UserID, "EXPENSE")
    budget = Budget(UserID=current_user.UserID, CategoryID=data.CategoryID, BudgetAmount=data.BudgetAmount, BudgetPeriod=data.BudgetPeriod.upper(), StartDate=data.StartDate, EndDate=data.EndDate)
    db.add(budget)
    try:
        db.commit(); db.refresh(budget)
        return budget
    except Exception:
        db.rollback(); raise HTTPException(status_code=500, detail="Could not create budget")


@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    budget = db.query(Budget).filter(Budget.BudgetID == budget_id, Budget.UserID == current_user.UserID).first()
    if not budget: raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget); db.commit()
    return {"message": "Budget deleted"}


@app.get("/savings-goals")
def get_savings_goals(current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    return db.query(SavingsGoal).filter(SavingsGoal.UserID == current_user.UserID).order_by(SavingsGoal.CreatedAt.desc()).all()


@app.post("/savings-goals", status_code=201)
def create_savings_goal(data: SavingsGoalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    goal = SavingsGoal(UserID=current_user.UserID, GoalName=data.GoalName, TargetAmount=data.TargetAmount, Deadline=data.Deadline)
    db.add(goal); db.commit(); db.refresh(goal)
    return goal


@app.post("/savings-goals/{goal_id}/contributions", status_code=201)
def contribute_to_goal(goal_id: int, data: GoalContributionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.GoalID == goal_id, SavingsGoal.UserID == current_user.UserID).with_for_update().first()
    if not goal: raise HTTPException(status_code=404, detail="Savings goal not found")
    contribution = GoalContribution(GoalID=goal.GoalID, UserID=current_user.UserID, Amount=data.Amount, Note=data.Note)
    goal.CurrentAmount = Decimal(str(goal.CurrentAmount or 0)) + data.Amount
    if goal.CurrentAmount >= goal.TargetAmount: goal.Status = "COMPLETED"
    db.add(contribution); db.commit(); db.refresh(goal)
    return goal


@app.get("/recurring-transactions")
def get_recurring_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    return db.query(RecurringTransaction).filter(RecurringTransaction.UserID == current_user.UserID, RecurringTransaction.IsActive == True).all()


@app.post("/recurring-transactions", status_code=201)
def create_recurring_transaction(data: RecurringTransactionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    transaction_type = data.TransactionType.upper()
    frequency = data.Frequency.upper()
    if transaction_type not in ("INCOME", "EXPENSE") or frequency not in ("WEEKLY", "MONTHLY", "YEARLY"):
        raise HTTPException(status_code=400, detail="Invalid recurring transaction type or frequency")
    get_owned_account(db, data.AccountID, current_user.UserID)
    get_owned_category(db, data.CategoryID, current_user.UserID, transaction_type)
    item = RecurringTransaction(UserID=current_user.UserID, AccountID=data.AccountID, CategoryID=data.CategoryID, Amount=data.Amount, TransactionType=transaction_type, Frequency=frequency, NextExecutionDate=data.NextExecutionDate, Description=data.Description, IsActive=True)
    db.add(item); db.commit(); db.refresh(item)
    return item


@app.delete("/recurring-transactions/{recurring_id}")
def delete_recurring_transaction(recurring_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    item = db.query(RecurringTransaction).filter(RecurringTransaction.RecurringTransactionID == recurring_id, RecurringTransaction.UserID == current_user.UserID, RecurringTransaction.IsActive == True).first()
    if not item: raise HTTPException(status_code=404, detail="Recurring transaction not found")
    item.IsActive = False; db.commit()
    return {"message": "Recurring transaction deactivated"}


# --------------------------------------------------
# NOTIFICATION MANAGEMENT
# --------------------------------------------------

@app.get("/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    mongo_items = mongo_list_notifications(current_user.UserID)
    if mongo_items is not None:
        return [{"NotificationID": str(item.get("_id", "")), "NotificationType": item.get("type"), "Message": item.get("message"), "IsRead": item.get("is_read", False), "CreatedAt": item.get("created_at")} for item in mongo_items]
    return db.query(Notification).filter(
        Notification.UserID == current_user.UserID
    ).order_by(Notification.CreatedAt.desc()).all()


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_database)):
    if mongo_enabled():
        if mongo_mark_notification_read(current_user.UserID, str(notification_id)):
            return {"message": "Notification marked as read"}
    item = db.query(Notification).filter(Notification.NotificationID == notification_id, Notification.UserID == current_user.UserID).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.IsRead = True
    db.commit()
    return {"message": "Notification marked as read"}


# --------------------------------------------------
# REPORT MANAGEMENT
# --------------------------------------------------

@app.get("/reports")
def get_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    return db.query(Report).filter(
        Report.UserID == current_user.UserID
    ).all()
