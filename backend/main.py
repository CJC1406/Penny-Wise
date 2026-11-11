
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from account_models import Account
from category_models import Category
from transaction_models import Transaction
from budget_models import Budget
from notification_models import Notification
from report_models import Report


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    return (
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
        .order_by(Transaction.TransactionDate.desc())
        .all()
    )


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
    return db.query(Budget).filter(
        Budget.UserID == current_user.UserID
    ).all()


# --------------------------------------------------
# NOTIFICATION MANAGEMENT
# --------------------------------------------------

@app.get("/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database)
):
    return db.query(Notification).filter(
        Notification.UserID == current_user.UserID
    ).all()


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
