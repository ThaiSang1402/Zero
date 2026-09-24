/**
 * Database module — sql.js với migration tự động cho Business features
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.db');

let sqlDb = null;
let dbWrapper = null;
let inTransaction = false;

function saveDb() {
  if (!sqlDb) return;
  fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
}

// ── Wrapper (mimics better-sqlite3 API) ──────────────────────
function makeWrapper() {
  return {
    exec: (sql) => { sqlDb.exec(sql); },
    pragma: () => {},
    prepare: (sql) => ({
      get: (...args) => {
        const params = args.flat();
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length) stmt.bind(params);
          if (stmt.step()) return Object.assign({}, stmt.getAsObject());
          return undefined;
        } finally { stmt.free(); }
      },
      all: (...args) => {
        const params = args.flat();
        const rows = [];
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length) stmt.bind(params);
          while (stmt.step()) rows.push(Object.assign({}, stmt.getAsObject()));
          return rows;
        } finally { stmt.free(); }
      },
      run: (...args) => {
        const params = args.flat();
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length) stmt.bind(params);
          stmt.step();
        } finally { stmt.free(); }
        const last = sqlDb.exec('SELECT last_insert_rowid()');
        const lastInsertRowid = last[0]?.values[0]?.[0] ?? null;
        if (!inTransaction) saveDb();
        return { lastInsertRowid };
      },
    }),
    transaction: (fn) => (arg) => {
      inTransaction = true;
      sqlDb.run('BEGIN');
      try {
        const result = fn(arg);
        sqlDb.run('COMMIT');
        saveDb();
        return result;
      }
      catch (e) { sqlDb.run('ROLLBACK'); throw e; }
      finally { inTransaction = false; }
    },
  };
}

// ── Schema base ───────────────────────────────────────────────
function initSchema() {
  sqlDb.run('PRAGMA foreign_keys = ON');

  // Xóa các bảng cũ của phiên bản Business nếu tồn tại
  const tryRun = (sql) => { try { sqlDb.run(sql); } catch (_) {} };
  tryRun('DROP TABLE IF EXISTS departments');
  tryRun('DROP TABLE IF EXISTS approvals');
  tryRun('DROP TABLE IF EXISTS employees');
  tryRun('DROP TABLE IF EXISTS reports');
  
  // Kiểm tra nếu bảng budgets cũ có xung đột cột
  try {
    sqlDb.prepare('SELECT amount_limit FROM budgets LIMIT 1').free();
  } catch (_) {
    tryRun('DROP TABLE IF EXISTS budgets');
  }

  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'cash',
      balance REAL DEFAULT 0,
      icon TEXT DEFAULT '💵',
      color TEXT DEFAULT '#10b981',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet_id INTEGER,
      category_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount_limit REAL NOT NULL,
      month TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      deadline TEXT,
      icon TEXT DEFAULT '🎯',
      color TEXT DEFAULT '#8b5cf6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      person_name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      note TEXT,
      is_paid INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet_id INTEGER,
      category_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      frequency TEXT DEFAULT 'monthly',
      day_of_month INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

  `);

  migrate();
  seedCategories();
}


// ── Migration (Thêm cột wallet_id nếu bảng cũ chưa có) ─────────
function migrate() {
  const tryRun = (sql) => { try { sqlDb.run(sql); } catch (_) {} };
  tryRun('ALTER TABLE transactions ADD COLUMN wallet_id INTEGER');
}

// ── Seed categories ───────────────────────────────────────────
function seedCategories() {
  const count = dbWrapper.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (count.c > 0) return;
  const ins = dbWrapper.prepare('INSERT INTO categories (name, icon, type, color) VALUES (?, ?, ?, ?)');
  const insertAll = dbWrapper.transaction((cats) => { for (const c of cats) ins.run(c.name, c.icon, c.type, c.color); });
  insertAll([
    { name: 'Lương',         icon: '💼', type: 'income',  color: '#10b981' },
    { name: 'Freelance',     icon: '💻', type: 'income',  color: '#06b6d4' },
    { name: 'Đầu tư',        icon: '📈', type: 'income',  color: '#8b5cf6' },
    { name: 'Quà tặng',      icon: '🎁', type: 'income',  color: '#f59e0b' },
    { name: 'Thu nhập khác', icon: '💰', type: 'income',  color: '#84cc16' },
    { name: 'Ăn uống',       icon: '🍜', type: 'expense', color: '#f97316' },
    { name: 'Di chuyển',     icon: '🚗', type: 'expense', color: '#3b82f6' },
    { name: 'Mua sắm',       icon: '🛍️', type: 'expense', color: '#ec4899' },
    { name: 'Giải trí',      icon: '🎮', type: 'expense', color: '#a855f7' },
    { name: 'Y tế',          icon: '🏥', type: 'expense', color: '#ef4444' },
    { name: 'Giáo dục',      icon: '📚', type: 'expense', color: '#14b8a6' },
    { name: 'Hóa đơn',       icon: '🧾', type: 'expense', color: '#64748b' },
    { name: 'Nhà ở',         icon: '🏠', type: 'expense', color: '#78716c' },
    { name: 'Chi khác',      icon: '💸', type: 'expense', color: '#6b7280' },
  ]);
}

// ── Public API ────────────────────────────────────────────────
async function initDb() {
  if (dbWrapper) return dbWrapper;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('📂 Loaded existing database from', DB_PATH);
  } else {
    sqlDb = new SQL.Database();
    console.log('🆕 Created new database at', DB_PATH);
  }
  dbWrapper = makeWrapper();
  initSchema();
  return dbWrapper;
}

function getDb() {
  if (!dbWrapper) throw new Error('DB not ready — await initDb() first');
  return dbWrapper;
}

module.exports = { initDb, getDb };

