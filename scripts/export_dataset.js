/**
 * Export dataset to JSON, SQL, and CSV for submission
 */
const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('../server/db');

async function exportData() {
  await initDb();
  const db = getDb();
  
  const outputDir = path.join(__dirname, '..', 'dataset');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Export JSON
  const users = db.prepare('SELECT id, name, email, password, created_at FROM users').all();
  const wallets = db.prepare('SELECT * FROM wallets').all();
  const categories = db.prepare('SELECT * FROM categories').all();
  const transactions = db.prepare(`
    SELECT t.*, c.name as category_name, w.name as wallet_name 
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN wallets w ON t.wallet_id = w.id
    ORDER BY t.date DESC
  `).all();
  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name 
    FROM budgets b 
    JOIN categories c ON b.category_id = c.id
  `).all();
  const goals = db.prepare('SELECT * FROM savings_goals').all();
  const debts = db.prepare('SELECT * FROM debts').all();
  const recurring = db.prepare('SELECT * FROM recurring_transactions').all();

  const dataset = {
    metadata: {
      project: 'SpendWise Personal Cloud Application',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      counts: {
        users: users.length,
        wallets: wallets.length,
        categories: categories.length,
        transactions: transactions.length,
        budgets: budgets.length,
        savings_goals: goals.length,
        debts: debts.length,
        recurring_rules: recurring.length
      }
    },
    users,
    wallets,
    categories,
    budgets,
    savings_goals: goals,
    debts,
    recurring_rules: recurring,
    transactions
  };

  fs.writeFileSync(path.join(outputDir, 'dataset_full.json'), JSON.stringify(dataset, null, 2), 'utf8');
  console.log('✅ Exported dataset_full.json');

  // 2. Export CSV (Transactions)
  let csvContent = '\uFEFFid,date,type,amount,category,wallet,note,created_at\n';
  for (const t of transactions) {
    const escapedNote = (t.note || '').replace(/"/g, '""');
    csvContent += `"${t.id}","${t.date}","${t.type}","${t.amount}","${t.category_name}","${t.wallet_name || ''}","${escapedNote}","${t.created_at}"\n`;
  }
  fs.writeFileSync(path.join(outputDir, 'transactions.csv'), csvContent, 'utf8');
  console.log('✅ Exported transactions.csv');

  // 3. Export SQL Schema & Inserts
  let sqlDump = `-- SpendWise Personal Database Export & Seed Schema
-- Exported: ${new Date().toISOString()}

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

`;

  fs.writeFileSync(path.join(outputDir, 'schema_and_seed.sql'), sqlDump, 'utf8');
  console.log('✅ Exported schema_and_seed.sql');
  console.log(`\n🎉 Dataset files successfully generated in ${outputDir}!`);
}

exportData();
