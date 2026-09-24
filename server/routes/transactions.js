const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/transactions
router.get('/', (req, res) => {
  const db = getDb();
  const { month, category_id, wallet_id, type, limit = 200, offset = 0 } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT t.*, 
           c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN wallets w ON t.wallet_id = w.id
    WHERE t.user_id = ?
  `;
  const params = [userId];

  if (month) { query += " AND strftime('%Y-%m', t.date) = ?"; params.push(month); }
  if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
  if (wallet_id) { query += ' AND t.wallet_id = ?'; params.push(wallet_id); }
  if (type) { query += ' AND t.type = ?'; params.push(type); }

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json(db.prepare(query).all(...params));
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { wallet_id, category_id, type, amount, note, date } = req.body;
  const userId = req.user.id;

  if (!category_id || !type || !amount || !date)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (danh mục, loại, số tiền, ngày).' });
  if (!['income', 'expense'].includes(type))
    return res.status(400).json({ error: 'Loại giao dịch không hợp lệ.' });
  if (Number(amount) <= 0)
    return res.status(400).json({ error: 'Số tiền phải lớn hơn 0.' });

  const db = getDb();
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id))
    return res.status(400).json({ error: 'Danh mục không tồn tại.' });

  let selectedWalletId = wallet_id;
  if (!selectedWalletId) {
    const firstWallet = db.prepare('SELECT id FROM wallets WHERE user_id = ? LIMIT 1').get(userId);
    selectedWalletId = firstWallet ? firstWallet.id : null;
  }

  const numAmount = Number(amount);

  const txProcess = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, note, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, selectedWalletId, category_id, type, numAmount, note || null, date);

    if (selectedWalletId) {
      const balanceChange = type === 'income' ? numAmount : -numAmount;
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ? AND user_id = ?').run(balanceChange, selectedWalletId, userId);
    }

    return result.lastInsertRowid;
  });

  const newTxId = txProcess();

  const tx = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM transactions t 
    JOIN categories c ON t.category_id = c.id 
    LEFT JOIN wallets w ON t.wallet_id = w.id
    WHERE t.id = ?
  `).get(newTxId);

  res.status(201).json(tx);
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

  const { wallet_id, category_id, type, amount, note, date } = req.body;
  const newType = type || tx.type;
  const newAmount = amount !== undefined ? Number(amount) : tx.amount;
  const newWalletId = wallet_id !== undefined ? wallet_id : tx.wallet_id;

  const updateTxProcess = db.transaction(() => {
    // Revert cũ
    if (tx.wallet_id) {
      const oldRevert = tx.type === 'income' ? -tx.amount : tx.amount;
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(oldRevert, tx.wallet_id);
    }

    // Update transaction
    db.prepare(`
      UPDATE transactions SET wallet_id=?, category_id=?, type=?, amount=?, note=?, date=?
      WHERE id=? AND user_id=?
    `).run(
      newWalletId, category_id || tx.category_id, newType, newAmount,
      note !== undefined ? note : tx.note, date || tx.date,
      tx.id, req.user.id
    );

    // Apply mới
    if (newWalletId) {
      const newApply = newType === 'income' ? newAmount : -newAmount;
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(newApply, newWalletId);
    }
  });

  updateTxProcess();

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           w.name as wallet_name, w.icon as wallet_icon
    FROM transactions t 
    JOIN categories c ON t.category_id = c.id 
    LEFT JOIN wallets w ON t.wallet_id = w.id
    WHERE t.id = ?
  `).get(tx.id);

  res.json(updated);
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

  const deleteTxProcess = db.transaction(() => {
    if (tx.wallet_id) {
      const revert = tx.type === 'income' ? -tx.amount : tx.amount;
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(revert, tx.wallet_id);
    }
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  });

  deleteTxProcess();
  res.json({ message: 'Đã xóa giao dịch thành công.' });
});

module.exports = router;

