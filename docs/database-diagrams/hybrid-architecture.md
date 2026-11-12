# PennyWise hybrid SQL + NoSQL architecture

```mermaid
flowchart TB
    APP["React Native + Expo mobile app"] --> API["FastAPI backend"]
    API --> SQL[("MySQL\nsource of truth")]
    API --> MONGO[("MongoDB\nflexible read models")]

    SQL --> CORE["Users\nAccounts\nCategories\nTransactions\nBudgets\nBalances"]
    MONGO --> DOCS["notifications\ntransactions_search"]

    API -->|expense created| CHECK["Calculate category spending\nand compare budget thresholds"]
    CHECK -->|75%, 90%, 100%+| MONGO
    API -->|create/update/delete transaction| SYNC["Upsert or delete search document"]
    SYNC --> MONGO
    API -->|filtered text + structured search| MONGO
    MONGO -->|results + total| API
    API --> APP

    RULE["Rule: financial calculations and balances always use MySQL"] -.-> SQL
```

## Request flows

1. **Budget alert:** save expense in MySQL → calculate category spending in MySQL → write a flexible alert document to MongoDB → show it in the notification centre.
2. **Transaction search:** synchronize the transaction read model → query MongoDB text and field indexes → return matching records and total expense.
3. **Fallback:** when MongoDB is not configured, the backend falls back to MySQL notification storage and SQL `LIKE` transaction search.
