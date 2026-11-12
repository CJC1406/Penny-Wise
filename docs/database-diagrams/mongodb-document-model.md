# PennyWise MongoDB document model

MongoDB is document-oriented, so this diagram shows collection ownership, document references, and indexes rather than foreign-key relationships.

```mermaid
flowchart LR
    U[(MySQL Users)] -. user_id .-> N[(notifications)]
    U -. user_id .-> T[(transactions_search)]
    B[(MySQL Budgets)] -. budget period .-> N
    X[(MySQL Transactions)] -. synchronized read model .-> T
    C[(MySQL Categories)] -. category label .-> T

    N --> N1{"Budget alert document"}
    T --> T1{"Search transaction document"}

    N1 --> N2["user_id\ntype: BUDGET_75 | BUDGET_90 | BUDGET_100\ncategory\nbudget\nspent\nexceeded_by\nmessage\nis_read\nbudget_start\ncreated_at"]
    T1 --> T2["transaction_id\nuser_id\naccount_id\naccount_name\ncategory_id\ncategory_name\namount\ntransaction_type\ndescription\nmerchant\npayment_method\ntransaction_date\nupdated_at"]

    N -. index .-> NI["{ user_id: 1, created_at: -1 }"]
    T -. indexes .-> TI["{ user_id: 1, transaction_date: -1 }\n{ category_id: 1 }\n{ account_id: 1 }\ntext: description, merchant, category_name"]
```

## Notification document example

```json
{
  "user_id": 7,
  "type": "BUDGET_90",
  "category": "Food",
  "budget": 1000,
  "spent": 900,
  "exceeded_by": 0,
  "message": "You have used 90% of your Food budget.",
  "is_read": false,
  "budget_start": "2026-11-01",
  "created_at": "2026-11-12T10:30:00Z"
}
```

## Search document example

```json
{
  "transaction_id": 481,
  "user_id": 7,
  "account_id": 3,
  "category_id": 5,
  "category_name": "Food",
  "amount": 900,
  "transaction_type": "EXPENSE",
  "description": "Dinner with family",
  "merchant": "Local Restaurant",
  "transaction_date": "2026-11-12T19:45:00Z",
  "updated_at": "2026-11-12T19:46:00Z"
}
```
