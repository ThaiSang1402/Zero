const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/budgets?month=YYYY-MM — Lấy danh sách hạn mức ngân sách tháng + số tiền đã chi thực tế
router.get('/', (req, res) => {
  const db = getDb();
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const query = `
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           COALESCE(SUM(t.amount), 0) as spent_amount
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON t.category_id = b.category_id 
                            AND t.user_id = b.user_id 
                            AND t.type = 'expense'
                            AND strftime('%Y-%m', t.date) = b.month
    WHERE b.user_id = ? AND b.month = ?
    GROUP BY b.id
    ORDER BY b.amount_limit DESC
  `;

  const budgets = db.prepare(query).all(req.user.id, month);
  res.json(budgets);
});

// POST /api/budgets — Đặt / Cập nhật ngân sách cho danh mục
router.post('/', (req, res) => {
  const { category_id, amount_limit, month } = req.body;
  if (!category_id || !amount_limit || Number(amount_limit) <= 0 || !month) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ danh mục, tháng và hạn mức > 0.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?')
                     .get(req.user.id, category_id, month);

  if (existing) {
    db.prepare('UPDATE budgets SET amount_limit = ? WHERE id = ?').run(Number(amount_limit), existing.id);
    const updated = db.prepare('SELECT * FROM budgets WHERE id = ?').get(existing.id);
    return res.json(updated);
  } else {
    const result = db.prepare('INSERT INTO budgets (user_id, category_id, amount_limit, month) VALUES (?, ?, ?, ?)')
                     .run(req.user.id, category_id, Number(amount_limit), month);
    const newBudget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(newBudget);
  }
});

// DELETE /api/budgets/:id — Xóa ngân sách
router.delete('/:id', (req, res) => {
  const db = getDb();
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!budget) return res.status(404).json({ error: 'Không tìm thấy ngân sách.' });

  db.prepare('DELETE FROM budgets WHERE id = ?').run(budget.id);
  res.json({ message: 'Đã xóa ngân sách thành công.' });
});

module.exports = router;
