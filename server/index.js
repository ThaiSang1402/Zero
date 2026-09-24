require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/wallets', require('./routes/wallets'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/recurring', require('./routes/recurring'));

app.get('/api/health', (req, res) => {
  const { supabase } = require('./supabase');
  res.json({
    status: supabase ? 'ok' : 'warning',
    message: supabase
      ? 'SpendWise Personal đang chạy! (Supabase Cloud)'
      : '⚠️ Supabase chưa kết nối — kiểm tra Environment Variables',
    supabase_connected: !!supabase,
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback — serve index.html cho mọi route không phải API
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Không tìm thấy trang.' });
  }
});

// Chỉ start server khi chạy trực tiếp (không phải Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 SpendWise Personal: http://localhost:${PORT}`);
    console.log(`💎 Ứng dụng Quản lý Chi tiêu Cá nhân trên Cloud`);
    console.log(`⚡ Đang sử dụng Supabase Cloud Database\n`);
  });
}

module.exports = app;

