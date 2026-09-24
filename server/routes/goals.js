const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/goals — Lấy các mục tiêu tiết kiệm
router.get('/', (req, res) => {
  const db = getDb();
  const goals = db.prepare('SELECT * FROM goals_view WHERE user_id = ?').all ? 
                db.prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY deadline ASC, created_at DESC').all(req.user.id) : [];
  res.json(goals);
});

// POST /api/goals — Tạo mục tiêu tiết kiệm mới
router.post('/', (req, res) => {
  const { name, target_amount, current_amount = 0, deadline, icon, color } = req.body;
  if (!name || !target_amount || Number(target_amount) <= 0) {
    return res.status(400).json({ error: 'Tên mục tiêu và số tiền mục tiêu phải hợp lệ (> 0).' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO savings_goals (user_id, name, target_amount, current_amount, deadline, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    name,
    Number(target_amount),
    Number(current_amount) || 0,
    deadline || null,
    icon || '🎯',
    color || '#8b5cf6'
  );

  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(goal);
});

// POST /api/goals/:id/deposit — Thêm tiền vào mục tiêu tiết kiệm
router.post('/:id/deposit', (req, res) => {
  const { amount, wallet_id } = req.body;
  const depositAmount = Number(amount);
  if (!depositAmount || depositAmount <= 0) return res.status(400).json({ error: 'Số tiền nạp phải lớn hơn 0.' });

  const db = getDb();
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Không tìm thấy mục tiêu tiết kiệm.' });

  if (wallet_id) {
    const wallet = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(wallet_id, req.user.id);
    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });
    if (wallet.balance < depositAmount) return res.status(400).json({ error: `Số dư ví "${wallet.name}" không đủ.` });
    
    // Trừ tiền khỏi ví và cộng vào mục tiêu tiết kiệm trong transaction
    const depositTx = db.transaction(() => {
      db.prepare('UPDATE wallets SET balance = balance - ? WHERE id = ?').run(depositAmount, wallet.id);
      db.prepare('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?').run(depositAmount, goal.id);
    });
    depositTx();
  } else {
    db.prepare('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ?').run(depositAmount, goal.id);
  }

  const updatedGoal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goal.id);
  res.json(updatedGoal);
});

// DELETE /api/goals/:id — Xóa mục tiêu
router.delete('/:id', (req, res) => {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Không tìm thấy mục tiêu tiết kiệm.' });

  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(goal.id);
  res.json({ message: 'Đã xóa mục tiêu tiết kiệm.' });
});

module.exports = router;
