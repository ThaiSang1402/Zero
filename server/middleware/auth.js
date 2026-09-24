const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'spendwise_personal_secret_key_2024_secure';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', payload.id)
      .single();
    if (error || !user) return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
