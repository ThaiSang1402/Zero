-- SpendWise Personal Database Export & Seed Schema
-- Exported: 2026-09-24T21:47:35.252Z

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6b7280'
);

-- 3. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  balance REAL NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '💵',
  color TEXT DEFAULT '#10b981',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount REAL NOT NULL CHECK(amount > 0),
  note TEXT,
  date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount_limit REAL NOT NULL CHECK(amount_limit > 0),
  month TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category_id, month)
);

-- 6. Savings Goals Table
CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  deadline DATE,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Debts Table
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('lend', 'borrow')),
  amount REAL NOT NULL,
  due_date DATE,
  note TEXT,
  is_paid INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Recurring Transactions Table
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount REAL NOT NULL,
  note TEXT,
  day_of_month INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 31),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data Seed:
-- User: demo@example.com (Password: demo123 - bcrypt hashed)
INSERT OR IGNORE INTO users (id, name, email, password) VALUES 
(1, 'Nguyễn Văn A', 'demo@example.com', '$2a$10$7vY8.gq2.7k6q8u9v0w1xe.d8e9r2f5t4g3h2j1k0l9m8n7b6v5c4');

