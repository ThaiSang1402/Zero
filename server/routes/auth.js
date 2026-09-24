const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
    if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });

    // Kiểm tra email đã tồn tại
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email này đã được đăng ký.' });

    const hash = await bcrypt.hash(password, 10);
    const { data: user, error: insertErr } = await supabase
      .from('users')
      .insert({ name, email, password: hash })
      .select('id, name, email')
      .single();

    if (insertErr) throw insertErr;

    // Tạo mặc định 2 ví tiền cho user mới
    await supabase.from('wallets').insert([
      { user_id: user.id, name: 'Tiền mặt', type: 'cash', balance: 0, icon: '💵', color: '#10b981' },
      { user_id: user.id, name: 'Tài khoản Ngân hàng', type: 'bank', balance: 0, icon: '🏦', color: '#3b82f6' },
    ]);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Đăng ký thành công!', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi server khi đăng ký.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });

    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi server khi đăng nhập.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
