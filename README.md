# PennyWise – Personal Finance Management System

PennyWise is a Personal Finance Management System developed as a DBMS lab project. It helps users manage accounts, track income and expenses, organize budgets, and view financial reports.

## Technology Stack

- **Mobile App:** React Native, Expo, TypeScript
- **Backend:** Python, FastAPI
- **Database:** MySQL
- **NoSQL:** MongoDB (notifications, activity-ready transaction search index)
- **ORM:** SQLAlchemy
- **Authentication:** JWT and Argon2 password hashing

## Main Features

- User account management
- Multiple financial accounts
- Income and expense tracking
- Transaction categories
- Budget management
- Notifications
- Financial reports and analytics

## Project Structure

```text
PennyWise/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   └── ... 
├── database/
│   ├── schema.sql
│   └── sample_data.sql
├── src/
│   └── app/
├── package.json
└── README.md
```

## Database Setup

1. Install MySQL.
2. Create the database:

```sql
CREATE DATABASE PersonalFinanceDB;
```

3. Import the schema:

```bash
mysql -u YOUR_MYSQL_USER -p PersonalFinanceDB < database/schema.sql
```

For an existing database, do not re-import or recreate the schema. Back it up and
apply the additive scripts in `database/migrations/` in order.

Migration order:

```text
000_migration_tracking.sql
001_add_opening_balance.sql
002_finance_extensions.sql
003_views_and_procedures.sql
```

The migration set preserves existing users, accounts, categories, transactions,
budgets, notifications, and reports. Apply it only after taking a MySQL backup.

To back up and apply all migrations automatically after MySQL is running:

```bash
python3 scripts/apply_migrations.py
```

4. Import the sample data after valid demo password hashes have been added:

```bash
mysql -u YOUR_MYSQL_USER -p PersonalFinanceDB < database/sample_data.sql
```

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi "uvicorn[standard]" sqlalchemy pymysql python-dotenv passlib argon2-cffi python-jose
```

Create a `.env` file in `backend/` with your own database connection and JWT secret:

```env
DATABASE_URL=mysql+pymysql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:3306/PersonalFinanceDB
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
MONGODB_URL=mongodb://127.0.0.1:27017
MONGODB_DATABASE=pennywise
```

Start the backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API documentation: `http://127.0.0.1:8000/docs`

## Mobile App Setup

From the project root:

```bash
npm install
npx expo start
```

Scan the QR code using Expo Go.

## Security Notes

- Never commit `.env` files or database credentials.
- Use valid Argon2 password hashes for demo users.
- Enforce user-specific authorization on all API endpoints before deployment.
- Do not expose real personal or financial records in public repositories.

## DBMS Properties Used in PennyWise

PennyWise uses the four ACID properties of database transactions to maintain the accuracy, consistency, and reliability of financial records.

### 1. Atomicity
Atomicity ensures that a database operation is completed fully or not performed at all.

In PennyWise, recording an income or expense involves inserting a transaction record and updating the corresponding account balance. These operations should be handled as a single database transaction so that a failure does not leave the transaction history and account balance inconsistent.

### 2. Consistency
Consistency ensures that database operations preserve the integrity of the data.

PennyWise uses primary keys, foreign keys, data types, constraints, and application-level validation to maintain valid relationships between users, accounts, categories, transactions, and budgets.

### 3. Isolation
Isolation ensures that concurrent database operations do not produce incorrect results.

When multiple requests access or update account balances simultaneously, appropriate transaction isolation and locking help prevent conflicting updates and incorrect balance calculations.

### 4. Durability
Durability ensures that committed database changes are permanently stored.

PennyWise uses MySQL to persist user information, account details, transactions, budgets, notifications, and reports. Committed records remain stored even after the application or database connection is closed.

### Conclusion
The ACID properties are important in PennyWise because financial applications require reliable transaction processing and accurate account balances. These properties help protect financial records and maintain database integrity.
