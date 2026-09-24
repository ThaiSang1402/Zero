const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/debts — Lấy danh sách nợ & cho vay
router.get('/', (req, res) => {
  const db = getDb();
  const debts = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY is_paid ASC, due_date ASC, created_at DESC').all(req.user.id);
  res.json(debts);
});

// POST /api/debts — Tạo khoản nợ / cho vay mới
router.post('/', (req, res) => {
  const { person_name, type, amount, due_date, note } = req.body;
  if (!person_name || !type || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Vui lòng nhập người liên quan, loại khoản tiền và số tiền > 0.' });
  }
  if (!['lend', 'borrow'].includes(type)) {
    return res.status(400).json({ error: 'Loại khoản nợ không hợp lệ.' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO debts (user_id, person_name, type, amount, due_date, note, is_paid)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(req.user.id, person_name, type, Number(amount), due_date || null, note || null);

  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(debt);
});

// PATCH /api/debts/:id/toggle-paid — Đánh dấu đã trả / thu xong nợ
router.patch('/:id/toggle-paid', (req, res) => {
  const db = getDb();
  const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!debt) return res.status(404).json({ error: 'Không tìm thấy thông tin vay/nợ.' });

  const newStatus = debt.is_paid === 1 ? 0 : 1;
  db.prepare('UPDATE debts SET is_paid = ? WHERE id = ?').run(newStatus, debt.id);

  const updated = db.prepare('SELECT * FROM debts WHERE id = ?').get(debt.id);
  res.json(updated);
});

// DELETE /api/debts/:id — Xóa khoản nợ
router.delete('/:id', (req, res) => {
  const db = getDb();
  const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!debt) return res.status(404).json({ error: 'Không tìm thấy thông tin vay/nợ.' });

  db.prepare('DELETE FROM debts WHERE id = ?').run(debt.id);
  res.json({ message: 'Đã xóa khoản nợ thành công.' });
});

module.exports = router;
