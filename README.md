# PennyWise – Personal Finance Management System

PennyWise is a Personal Finance Management System developed as a DBMS lab project. It helps users manage accounts, track income and expenses, organize budgets, and view financial reports.

## Technology Stack

- **Mobile App:** React Native, Expo, TypeScript
- **Backend:** Python, FastAPI
- **Database:** MySQL
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

## Project Status

PennyWise includes the mobile app structure, FastAPI backend, and MySQL database schema with sample records. Authentication, authorization, and full mobile-to-backend integration are planned development steps.
