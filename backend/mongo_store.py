import os
from datetime import datetime
from decimal import Decimal

try:
    from pymongo import ASCENDING, DESCENDING, MongoClient
except ImportError:  # MongoDB is enabled when pymongo is installed.
    MongoClient = None


_client = None
_database = None


def mongo_enabled():
    return MongoClient is not None and bool(os.getenv("MONGODB_URL"))


def get_database():
    global _client, _database
    if not mongo_enabled():
        return None
    if _database is None:
        _client = MongoClient(os.getenv("MONGODB_URL"), serverSelectionTimeoutMS=3000)
        _database = _client[os.getenv("MONGODB_DATABASE", "pennywise")]
        _database.notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        _database.transactions_search.create_index([
            ("user_id", ASCENDING), ("transaction_date", DESCENDING),
            ("category_id", ASCENDING), ("account_id", ASCENDING),
        ])
        _database.transactions_search.create_index([("description", "text"), ("merchant", "text"), ("category_name", "text")])
    return _database


def decimal_value(value):
    return float(value or 0)


def transaction_document(transaction, user_id, category_name=None, account_name=None):
    return {
        "transaction_id": transaction.TransactionID,
        "user_id": user_id,
        "account_id": transaction.AccountID,
        "account_name": account_name,
        "category_id": transaction.CategoryID,
        "category_name": category_name,
        "amount": decimal_value(transaction.Amount),
        "transaction_type": transaction.TransactionType,
        "description": transaction.Description,
        "merchant": transaction.Merchant,
        "payment_method": transaction.PaymentMethod,
        "transaction_date": transaction.TransactionDate,
        "updated_at": datetime.utcnow(),
    }


def upsert_transaction(transaction, user_id, category_name=None, account_name=None):
    database = get_database()
    if database is not None:
        database.transactions_search.update_one(
            {"transaction_id": transaction.TransactionID, "user_id": user_id},
            {"$set": transaction_document(transaction, user_id, category_name, account_name)},
            upsert=True,
        )


def delete_transaction(transaction_id, user_id):
    database = get_database()
    if database is not None:
        database.transactions_search.delete_one({"transaction_id": transaction_id, "user_id": user_id})


def add_notification(user_id, notification_type, category, budget, spent, message):
    database = get_database()
    if database is None:
        return False
    database.notifications.update_one(
        {"user_id": user_id, "type": notification_type, "category": category, "budget_start": budget.StartDate},
        {"$setOnInsert": {
            "user_id": user_id, "type": notification_type, "category": category,
            "budget": decimal_value(budget.BudgetAmount), "spent": decimal_value(spent),
            "exceeded_by": decimal_value(max(spent - Decimal(str(budget.BudgetAmount)), Decimal("0"))),
            "message": message, "is_read": False, "budget_start": budget.StartDate,
            "created_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    return True


def list_notifications(user_id):
    database = get_database()
    if database is None:
        return None
    return list(database.notifications.find({"user_id": user_id}).sort("created_at", DESCENDING))


def mark_notification_read(user_id, notification_id):
    database = get_database()
    if database is None:
        return False
    from bson import ObjectId
    result = database.notifications.update_one({"_id": ObjectId(notification_id), "user_id": user_id}, {"$set": {"is_read": True}})
    return result.matched_count > 0


def search_transactions(user_id, filters):
    database = get_database()
    if database is None:
        return None
    query = {"user_id": user_id}
    if filters.get("text"):
        query["$text"] = {"$search": filters["text"]}
    mapping = {"category_id": "category_id", "account_id": "account_id", "transaction_type": "transaction_type"}
    for source, target in mapping.items():
        if filters.get(source) is not None:
            query[target] = filters[source]
    date_query = {}
    if filters.get("start_date"): date_query["$gte"] = filters["start_date"]
    if filters.get("end_date"): date_query["$lte"] = filters["end_date"]
    if date_query: query["transaction_date"] = date_query
    amount_query = {}
    if filters.get("min_amount") is not None: amount_query["$gte"] = filters["min_amount"]
    if filters.get("max_amount") is not None: amount_query["$lte"] = filters["max_amount"]
    if amount_query: query["amount"] = amount_query
    rows = list(database.transactions_search.find(query, {"_id": 0}).sort("transaction_date", DESCENDING))
    return rows
