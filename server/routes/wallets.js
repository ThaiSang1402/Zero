const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/wallets — Lấy tất cả ví tiền của user
router.get('/', (req, res) => {
  const db = getDb();
  const wallets = db.prepare('SELECT * FROM wallets WHERE user_id = ? ORDER BY id ASC').all(req.user.id);
  res.json(wallets);
});

// POST /api/wallets — Tạo ví mới
router.post('/', (req, res) => {
  const { name, type, balance = 0, icon, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên ví không được để trống.' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO wallets (user_id, name, type, balance, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    name,
    type || 'cash',
    Number(balance) || 0,
    icon || '💵',
    color || '#10b981'
  );

  const newWallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newWallet);
});

// PUT /api/wallets/:id — Sửa thông tin ví
router.put('/:id', (req, res) => {
  const db = getDb();
  const wallet = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });

  const { name, type, balance, icon, color } = req.body;
  db.prepare(`
    UPDATE wallets SET name=?, type=?, balance=?, icon=?, color=? WHERE id=? AND user_id=?
  `).run(
    name || wallet.name,
    type || wallet.type,
    balance !== undefined ? Number(balance) : wallet.balance,
    icon || wallet.icon,
    color || wallet.color,
    wallet.id,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM wallets WHERE id = ?').get(wallet.id);
  res.json(updated);
});

// DELETE /api/wallets/:id — Xóa ví
router.delete('/:id', (req, res) => {
  const db = getDb();
  const wallet = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });

  db.prepare('DELETE FROM wallets WHERE id = ?').run(wallet.id);
  res.json({ message: 'Đã xóa ví tiền thành công.' });
});

// POST /api/wallets/transfer — Chuyển tiền giữa 2 ví
router.post('/transfer', (req, res) => {
  const { from_wallet_id, to_wallet_id, amount, note } = req.body;
  if (!from_wallet_id || !to_wallet_id || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Vui lòng chọn đầy đủ ví và số tiền chuyển hợp lệ.' });
  }
  if (from_wallet_id === to_wallet_id) {
    return res.status(400).json({ error: 'Ví nguồn và ví đích phải khác nhau.' });
  }

  const db = getDb();
  const fromWallet = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(from_wallet_id, req.user.id);
  const toWallet = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(to_wallet_id, req.user.id);

  if (!fromWallet || !toWallet) return res.status(404).json({ error: 'Không tìm thấy thông tin ví.' });
  if (fromWallet.balance < Number(amount)) {
    return res.status(400).json({ error: `Số dư ví "${fromWallet.name}" không đủ để chuyển.` });
  }

  const transferAmount = Number(amount);
  const transfer = db.transaction(() => {
    db.prepare('UPDATE wallets SET balance = balance - ? WHERE id = ?').run(transferAmount, fromWallet.id);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(transferAmount, toWallet.id);
  });

  transfer();
  res.json({ message: `Đã chuyển ₫${transferAmount.toLocaleString('vi-VN')} từ "${fromWallet.name}" sang "${toWallet.name}".` });
});

module.exports = router;
