/**
 * Seed script — tạo tài khoản demo và dữ liệu cá nhân mẫu
 * Chạy: node seed.js
 */
const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./server/db');

async function seed() {
  await initDb();
  const db = getDb();

  console.log('🌱 Bắt đầu tạo dữ liệu mẫu Cá Nhân...\n');

  // Xóa user demo cũ nếu đã tồn tại
  const existing = db.prepare("SELECT id FROM users WHERE email = 'demo@example.com'").get();
  if (existing) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    console.log('🗑️ Đã xóa dữ liệu tài khoản demo cũ');
  }

  // Tạo user demo
  const hash = await bcrypt.hash('demo123', 10);
  const userResult = db.prepare(
    "INSERT INTO users (name, email, password) VALUES ('Nguyễn Văn A', 'demo@example.com', ?)"
  ).run(hash);
  const userId = userResult.lastInsertRowid;
  console.log(`✅ Tạo tài khoản: demo@example.com / demo123 (ID: ${userId})`);

  // 1. Tạo 4 Ví tiền mẫu
  const walletCash = db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Tiền mặt', 'cash', 2500000, '💵', '#10b981').lastInsertRowid;
  const walletBank = db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Vietcombank', 'bank', 38500000, '🏦', '#3b82f6').lastInsertRowid;
  const walletMomo = db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Ví MoMo', 'ewallet', 1800000, '📱', '#ec4899').lastInsertRowid;
  const walletCredit = db.prepare('INSERT INTO wallets (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Thẻ Tín Dụng', 'credit', -2500000, '💳', '#f59e0b').lastInsertRowid;

  console.log('✅ Đã tạo 4 ví tiền mẫu');

  // Lấy map categories
  const cats = db.prepare('SELECT * FROM categories').all();
  const catMap = {};
  for (const c of cats) catMap[c.name] = c.id;

  // 2. Tạo Ngân sách tháng hiện tại
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (catMap['Ăn uống']) db.prepare('INSERT INTO budgets (user_id, category_id, amount_limit, month) VALUES (?, ?, ?, ?)').run(userId, catMap['Ăn uống'], 4000000, currentMonth);
  if (catMap['Mua sắm']) db.prepare('INSERT INTO budgets (user_id, category_id, amount_limit, month) VALUES (?, ?, ?, ?)').run(userId, catMap['Mua sắm'], 2000000, currentMonth);
  if (catMap['Giải trí']) db.prepare('INSERT INTO budgets (user_id, category_id, amount_limit, month) VALUES (?, ?, ?, ?)').run(userId, catMap['Giải trí'], 1500000, currentMonth);
  if (catMap['Di chuyển']) db.prepare('INSERT INTO budgets (user_id, category_id, amount_limit, month) VALUES (?, ?, ?, ?)').run(userId, catMap['Di chuyển'], 1000000, currentMonth);
  console.log('✅ Đã tạo ngân sách tháng');

  // 3. Tạo Mục tiêu tiết kiệm mẫu
  db.prepare('INSERT INTO savings_goals (user_id, name, target_amount, current_amount, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'Mua Macbook Pro M3', 35000000, 18000000, '2026-12-31', '💻', '#3b82f6');
  db.prepare('INSERT INTO savings_goals (user_id, name, target_amount, current_amount, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'Quỹ Khẩn Cấp', 50000000, 30000000, '2026-10-01', '🛡️', '#10b981');
  db.prepare('INSERT INTO savings_goals (user_id, name, target_amount, current_amount, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'Du lịch Nhật Bản', 25000000, 8500000, '2027-04-15', '✈️', '#ec4899');
  console.log('✅ Đã tạo 3 mục tiêu tiết kiệm');

  // 4. Tạo Sổ Nợ / Cho Vay mẫu
  db.prepare('INSERT INTO debts (user_id, person_name, type, amount, due_date, note, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'Anh Nam (Đồng nghiệp)', 'lend', 2000000, '2026-09-15', 'Cho vay tiền mừng cưới', 0);
  db.prepare('INSERT INTO debts (user_id, person_name, type, amount, due_date, note, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'Anh Hùng', 'borrow', 500000, '2026-09-10', 'Nợ tiền vé xem ca nhạc', 0);
  console.log('✅ Đã tạo sổ theo dõi Vay & Nợ');

  // 5. Tạo Quy tắc Giao dịch Định kỳ mẫu
  if (catMap['Nhà ở']) {
    db.prepare('INSERT INTO recurring_transactions (user_id, wallet_id, category_id, type, amount, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, walletBank, catMap['Nhà ở'], 'expense', 4500000, 'Tiền thuê căn hộ', 1);
  }
  if (catMap['Hóa đơn']) {
    db.prepare('INSERT INTO recurring_transactions (user_id, wallet_id, category_id, type, amount, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, walletMomo, catMap['Hóa đơn'], 'expense', 850000, 'Gói Internet FPT + Điện Nước', 5);
  }
  if (catMap['Lương']) {
    db.prepare('INSERT INTO recurring_transactions (user_id, wallet_id, category_id, type, amount, note, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, walletBank, catMap['Lương'], 'income', 22000000, 'Lương cố định công ty', 1);
  }
  console.log('✅ Đã tạo 3 quy tắc giao dịch định kỳ');


  // 5. Tạo giao dịch mẫu cho 3 tháng gần nhất
  const now = new Date();
  const transactions = [];

  for (let m = 2; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;

    transactions.push(
      // Thu nhập
      { cat: 'Lương',         type: 'income',  amount: 22000000, wallet: walletBank, note: `Lương nhận chuyển khoản tháng ${month}`, date: `${prefix}-01` },
      { cat: 'Freelance',     type: 'income',  amount: 4500000,  wallet: walletBank, note: 'Làm dự án Landing Page', date: `${prefix}-10` },
      { cat: 'Đầu tư',        type: 'income',  amount: 1200000,  wallet: walletBank, note: 'Tiền lãi tiết kiệm', date: `${prefix}-15` },
      // Chi tiêu
      { cat: 'Nhà ở',         type: 'expense', amount: 4500000,  wallet: walletBank, note: 'Tiền thuê căn hộ tháng này', date: `${prefix}-01` },
      { cat: 'Hóa đơn',       type: 'expense', amount: 850000,   wallet: walletMomo, note: 'Điện + Nước + Wifi', date: `${prefix}-05` },
      { cat: 'Ăn uống',       type: 'expense', amount: 550000,   wallet: walletCash, note: 'Đi siêu thị WinMart', date: `${prefix}-03` },
      { cat: 'Ăn uống',       type: 'expense', amount: 420000,   wallet: walletMomo, note: 'Ăn tối cùng bạn bè', date: `${prefix}-08` },
      { cat: 'Ăn uống',       type: 'expense', amount: 680000,   wallet: walletCash, note: 'Ăn uống gia đình', date: `${prefix}-18` },
      { cat: 'Di chuyển',     type: 'expense', amount: 350000,   wallet: walletMomo, note: 'Nạp tiền Xăng + Grab', date: `${prefix}-06` },
      { cat: 'Mua sắm',       type: 'expense', amount: 1250000,  wallet: walletCredit, note: 'Mua quần áo mới Uniqlo', date: `${prefix}-12` },
      { cat: 'Giải trí',      type: 'expense', amount: 260000,   wallet: walletCredit, note: 'Gói Netflix + Spotify', date: `${prefix}-01` },
      { cat: 'Giải trí',      type: 'expense', amount: 450000,   wallet: walletMomo, note: 'Xem phim CGV', date: `${prefix}-22` },
      { cat: 'Y tế',          type: 'expense', amount: 320000,   wallet: walletCash, note: 'Mua thuốc bổ', date: `${prefix}-14` }
    );
  }

  const insert = db.prepare(
    'INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const t of transactions) {
    const catId = catMap[t.cat];
    if (catId) {
      insert.run(userId, t.wallet, catId, t.type, t.amount, t.note, t.date);
    }
  }

  console.log(`✅ Đã tạo ${transactions.length} giao dịch mẫu (3 tháng)`);
  console.log('\n🎉 Seed thành công SpendWise Personal!');
  console.log('   📧 Email:    demo@example.com');
  console.log('   🔑 Password: demo123\n');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });

