const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });

  const db = getDb();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'Email này đã được đăng ký.' });

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);
  const userId = result.lastInsertRowid;

  // Tạo mặc định 2 ví tiền cho user mới (Tiền mặt + Ngân hàng)
  db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Tiền mặt', 'cash', 0, '💵', '#10b981');
  db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Tài khoản Ngân hàng', 'bank', 0, '🏦', '#3b82f6');

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ message: 'Đăng ký thành công!', token, user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    message: 'Đăng nhập thành công!',
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;

