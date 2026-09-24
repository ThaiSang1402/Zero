const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/recurring — Lấy danh sách giao dịch định kỳ của user
router.get('/', (req, res) => {
  const db = getDb();
  const list = db.prepare(`
    SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM recurring_transactions r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN wallets w ON r.wallet_id = w.id
    WHERE r.user_id = ?
    ORDER BY r.day_of_month ASC, r.created_at DESC
  `).all(req.user.id);
  res.json(list);
});

// POST /api/recurring — Tạo quy tắc giao dịch định kỳ mới
router.post('/', (req, res) => {
  const { wallet_id, category_id, type, amount, note, day_of_month = 1 } = req.body;
  if (!category_id || !type || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ danh mục, loại và số tiền hợp lệ (> 0).' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO recurring_transactions (user_id, wallet_id, category_id, type, amount, note, frequency, day_of_month)
    VALUES (?, ?, ?, ?, ?, ?, 'monthly', ?)
  `).run(req.user.id, wallet_id || null, category_id, type, Number(amount), note || null, Number(day_of_month) || 1);

  const newItem = db.prepare(`
    SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM recurring_transactions r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN wallets w ON r.wallet_id = w.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(newItem);
});

// POST /api/recurring/:id/execute — Ghi nhận nhanh 1 giao dịch từ quy tắc định kỳ
router.post('/:id/execute', (req, res) => {
  const db = getDb();
  const rule = db.prepare('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc giao dịch định kỳ.' });

  const todayStr = new Date().toISOString().slice(0, 10);
  const numAmount = Number(rule.amount);

  const executeTx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, note, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, rule.wallet_id, rule.category_id, rule.type, numAmount, `[Định kỳ] ${rule.note || ''}`, todayStr);

    if (rule.wallet_id) {
      const balanceChange = rule.type === 'income' ? numAmount : -numAmount;
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(balanceChange, rule.wallet_id);
    }
    return result.lastInsertRowid;
  });

  const txId = executeTx();
  const newTx = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon
    FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.id = ?
  `).get(txId);

  res.json({ message: `Đã ghi nhận giao dịch định kỳ thành công!`, transaction: newTx });
});

// DELETE /api/recurring/:id — Xóa quy tắc định kỳ
router.delete('/:id', (req, res) => {
  const db = getDb();
  const rule = db.prepare('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc định kỳ.' });

  db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(rule.id);
  res.json({ message: 'Đã xóa quy tắc định kỳ.' });
});

module.exports = router;
