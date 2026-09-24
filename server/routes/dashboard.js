const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/dashboard/summary?month=YYYY-MM
router.get('/summary', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const monthFilter = req.query.month || new Date().toISOString().slice(0, 7);

  // Tổng số dư tất cả các ví tiền (Net worth)
  const netWorthRow = db.prepare('SELECT SUM(balance) as total_net_worth FROM wallets WHERE user_id = ?').get(userId);
  const netWorth = netWorthRow ? (netWorthRow.total_net_worth || 0) : 0;

  // Tổng thu/chi trong tháng
  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expense,
      COUNT(*) as total_count
    FROM transactions
    WHERE user_id = ? AND strftime('%Y-%m', date) = ?
  `).get(userId, monthFilter);

  // Danh sách các ví tiền
  const wallets = db.prepare('SELECT * FROM wallets WHERE user_id = ? ORDER BY id ASC').all(userId);

  // Chi theo danh mục trong tháng
  const byCategory = db.prepare(`
    SELECT c.id, c.name, c.icon, c.color, t.type, SUM(t.amount) as total, COUNT(*) as count
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND strftime('%Y-%m', t.date) = ?
    GROUP BY t.category_id ORDER BY total DESC
  `).all(userId, monthFilter);

  // Thu chi 6 tháng gần nhất (cho biểu đồ)
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE user_id = ? AND date >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', date) ORDER BY month ASC
  `).all(userId);

  // 5 giao dịch mới nhất
  const recent = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM transactions t 
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN wallets w ON t.wallet_id = w.id
    WHERE t.user_id = ? ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `).all(userId);

  // ── Tính toán Cảnh báo Thông minh (Smart Alerts) ─────────────
  const alerts = [];

  // 1. Kiểm tra Cảnh báo Ngân sách
  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon,
           COALESCE(SUM(t.amount), 0) as spent_amount
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON t.category_id = b.category_id 
                            AND t.user_id = b.user_id 
                            AND t.type = 'expense'
                            AND strftime('%Y-%m', t.date) = b.month
    WHERE b.user_id = ? AND b.month = ?
    GROUP BY b.id
  `).all(userId, monthFilter);

  for (const b of budgets) {
    const pct = Math.round((b.spent_amount / b.amount_limit) * 100);
    if (pct >= 100) {
      alerts.push({
        id: `b-exp-${b.id}`,
        type: 'error',
        title: `🚨 Vượt hạn mức Ngân sách!`,
        message: `Danh mục ${b.category_icon} ${b.category_name} đã vượt ${pct}% ngân sách (${b.spent_amount.toLocaleString('vi-VN')}₫ / ${b.amount_limit.toLocaleString('vi-VN')}₫).`
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `b-warn-${b.id}`,
        type: 'warning',
        title: `⚠️ Cảnh báo Ngân sách`,
        message: `Danh mục ${b.category_icon} ${b.category_name} đã chi ${pct}% hạn mức tháng này.`
      });
    }
  }

  // 2. Kiểm tra Cảnh báo Vay & Nợ sắp tới hạn / quá hạn
  const today = new Date().toISOString().slice(0, 10);
  const pendingDebts = db.prepare(`
    SELECT * FROM debts WHERE user_id = ? AND is_paid = 0 AND due_date IS NOT NULL
  `).all(userId);

  for (const d of pendingDebts) {
    if (d.due_date < today) {
      alerts.push({
        id: `d-over-${d.id}`,
        type: 'error',
        title: `⏰ Khoản Nợ Quá Hạn!`,
        message: `${d.type === 'lend' ? 'Người dùng ' + d.person_name + ' chưa trả' : 'Bạn chưa trả khoản nợ ' + d.person_name} số tiền ${d.amount.toLocaleString('vi-VN')}₫ (Hạn: ${d.due_date}).`
      });
    } else if (d.due_date <= new Date(Date.now() + 5*24*3600*1000).toISOString().slice(0, 10)) {
      alerts.push({
        id: `d-due-${d.id}`,
        type: 'info',
        title: `📅 Sắp Đến Hạn Trả Nợ`,
        message: `Khoản nợ với ${d.person_name} (${d.amount.toLocaleString('vi-VN')}₫) sắp tới hạn ngày ${d.due_date}.`
      });
    }
  }

  res.json({
    month: monthFilter,
    summary: {
      total_income: totals ? (totals.total_income || 0) : 0,
      total_expense: totals ? (totals.total_expense || 0) : 0,
      total_count: totals ? (totals.total_count || 0) : 0,
      net_worth: netWorth,
    },
    alerts,
    wallets,
    by_category: byCategory,
    monthly_chart: monthly,
    recent_transactions: recent,
  });
});


// GET /api/dashboard/categories
router.get('/categories', (req, res) => {
  const db = getDb();
  const { type } = req.query;
  let query = 'SELECT * FROM categories';
  const params = [];
  if (type) { query += ' WHERE type = ?'; params.push(type); }
  query += ' ORDER BY type, name';
  res.json(db.prepare(query).all(...params));
});

module.exports = router;

