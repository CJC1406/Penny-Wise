# PennyWise database diagrams

These diagrams document the hybrid database design:

- `sql-er-diagram.md` — MySQL relational ER diagram, including the core finance tables and extension tables.
- `mongodb-document-model.md` — MongoDB collections, document shapes, and indexes used by notification storage and transaction search.
- `hybrid-architecture.md` — How FastAPI synchronizes MySQL financial records with MongoDB read models.

The Mermaid diagrams render in GitHub, VS Code extensions, and most Markdown viewers.

## Source of truth

MySQL is authoritative for users, accounts, categories, budgets, balances, and transactions. MongoDB stores flexible notification documents and a searchable transaction read model. MongoDB records must never be used to calculate account balances.
