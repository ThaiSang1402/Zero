require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./db');

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
  res.json({ status: 'ok', message: 'SpendWise Personal đang chạy!', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function main() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n🚀 SpendWise Personal: http://localhost:${PORT}`);
      console.log(`💎 Ứng dụng Quản lý Chi tiêu Cá nhân trên Cloud`);
      console.log(`💡 Tài khoản mẫu: demo@example.com / demo123\n`);
    });
  } catch (err) {
    console.error('❌ Khởi động thất bại:', err);
    process.exit(1);
  }
}

main();
module.exports = app;

