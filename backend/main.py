
from fastapi import FastAPI
from sqlalchemy import text

from database import SessionLocal

import models
import account_models
import category_models
import transaction_models
import budget_models
import notification_models


app = FastAPI(title="PennyWise API")


# Home endpoint
@app.get("/")
def home():
    return {"message": "Welcome to PennyWise API"}


# Database health check
@app.get("/health")
def health():
    db = SessionLocal()
    try:
        database = db.execute(text("SELECT DATABASE()")).scalar()
        return {
            "status": "connected",
            "database": database.lower() if database else None
        }
    finally:
        db.close()


# Get all users
@app.get("/users")
def get_users():
    db = SessionLocal()
    try:
        users = db.query(models.User).all()

        return [
            {
                "UserID": u.UserID,
                "Username": u.Username,
                "Email": u.Email,
                "FullName": u.FullName,
                "Phone": u.Phone,
                "CreatedAt": u.CreatedAt,
                "LastLogin": u.LastLogin
            }
            for u in users
        ]
    finally:
        db.close()


# Get all accounts
@app.get("/accounts")
def get_accounts():
    db = SessionLocal()
    try:
        accounts = db.query(account_models.Account).all()

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
    finally:
        db.close()


# Get all categories
@app.get("/categories")
def get_categories():
    db = SessionLocal()
    try:
        categories = db.query(category_models.Category).all()

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
    finally:
        db.close()


# Get all transactions
@app.get("/transactions")
def get_transactions():
    db = SessionLocal()
    try:
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
    finally:
        db.close()


# Get all budgets
@app.get("/budgets")
def get_budgets():
    db = SessionLocal()
    try:
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
    finally:
        db.close()


# Get all notifications
@app.get("/notifications")
def get_notifications():
    db = SessionLocal()
    try:
        notifications = (
            db.query(notification_models.Notification).all()
        )

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
    finally:
        db.close()
