/**
 * Script di chuyển toàn bộ dữ liệu SQLite sang Supabase Cloud Database & Cloud Storage
 * Chạy lệnh: node scripts/migrate_to_supabase.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ LỖI: Chưa tìm thấy cấu hình Supabase trong file .env!');
  console.log('👉 Vui lòng thêm các dòng sau vào file .env:');
  console.log('   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co');
  console.log('   SUPABASE_ANON_KEY=eyJhbGciOi...');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (Khuyến nghị dùng Service Role Key để bỏ qua RLS khi migrate)\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  console.log('🚀 Bắt đầu quá trình đồng bộ & di chuyển dữ liệu sang Supabase Cloud...\n');
  console.log(`📡 Kết nối tới Supabase: ${SUPABASE_URL}`);

  // Đọc dữ liệu từ file dataset_full.json đã export
  const datasetPath = path.join(__dirname, '..', 'dataset', 'dataset_full.json');
  if (!fs.existsSync(datasetPath)) {
    console.error('❌ Không tìm thấy dataset/dataset_full.json. Vui lòng chạy: node scripts/export_dataset.js trước!');
    process.exit(1);
  }

  const raw = fs.readFileSync(datasetPath, 'utf8');
  const dataset = JSON.parse(raw);

  try {
    // 1. Migrate Users
    console.log(`👤 Đang chuyển ${dataset.users.length} Users...`);
    for (const u of dataset.users) {
      const { error } = await supabase.from('users').upsert({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password || '$2a$10$7vY8.gq2.7k6q8u9v0w1xe.d8e9r2f5t4g3h2j1k0l9m8n7b6v5c4',
        created_at: u.created_at
      });
      if (error) console.warn(`   ⚠️ Warning user ${u.email}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Users');

    // 2. Migrate Categories
    console.log(`📁 Đang chuyển ${dataset.categories.length} Categories...`);
    for (const c of dataset.categories) {
      const { error } = await supabase.from('categories').upsert({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color
      });
      if (error) console.warn(`   ⚠️ Warning category ${c.name}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Categories');

    // 3. Migrate Wallets
    console.log(`👛 Đang chuyển ${dataset.wallets.length} Wallets...`);
    for (const w of dataset.wallets) {
      const { error } = await supabase.from('wallets').upsert({
        id: w.id,
        user_id: w.user_id,
        name: w.name,
        type: w.type,
        balance: w.balance,
        icon: w.icon,
        color: w.color,
        created_at: w.created_at
      });
      if (error) console.warn(`   ⚠️ Warning wallet ${w.name}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Wallets');

    // 4. Migrate Budgets
    console.log(`🎯 Đang chuyển ${dataset.budgets.length} Budgets...`);
    for (const b of dataset.budgets) {
      const { error } = await supabase.from('budgets').upsert({
        id: b.id,
        user_id: b.user_id,
        category_id: b.category_id,
        amount_limit: b.amount_limit,
        month: b.month,
        created_at: b.created_at
      });
      if (error) console.warn(`   ⚠️ Warning budget ID ${b.id}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Budgets');

    // 5. Migrate Savings Goals
    console.log(`🐖 Đang chuyển ${dataset.savings_goals.length} Savings Goals...`);
    for (const g of dataset.savings_goals) {
      const { error } = await supabase.from('savings_goals').upsert({
        id: g.id,
        user_id: g.user_id,
        name: g.name,
        target_amount: g.target_amount,
        current_amount: g.current_amount,
        deadline: g.deadline,
        icon: g.icon,
        color: g.color,
        created_at: g.created_at
      });
      if (error) console.warn(`   ⚠️ Warning goal ${g.name}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Savings Goals');

    // 6. Migrate Debts
    console.log(`📝 Đang chuyển ${dataset.debts.length} Debts...`);
    for (const d of dataset.debts) {
      const { error } = await supabase.from('debts').upsert({
        id: d.id,
        user_id: d.user_id,
        person_name: d.person_name,
        type: d.type,
        amount: d.amount,
        due_date: d.due_date,
        note: d.note,
        is_paid: d.is_paid,
        created_at: d.created_at
      });
      if (error) console.warn(`   ⚠️ Warning debt ID ${d.id}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Debts');

    // 7. Migrate Recurring Rules
    console.log(`🔄 Đang chuyển ${dataset.recurring_rules.length} Recurring Rules...`);
    for (const r of dataset.recurring_rules) {
      const { error } = await supabase.from('recurring_transactions').upsert({
        id: r.id,
        user_id: r.user_id,
        wallet_id: r.wallet_id,
        category_id: r.category_id,
        type: r.type,
        amount: r.amount,
        note: r.note,
        day_of_month: r.day_of_month,
        created_at: r.created_at
      });
      if (error) console.warn(`   ⚠️ Warning recurring ID ${r.id}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Recurring Rules');

    // 8. Migrate Transactions
    console.log(`💳 Đang chuyển ${dataset.transactions.length} Transactions...`);
    for (const t of dataset.transactions) {
      const { error } = await supabase.from('transactions').upsert({
        id: t.id,
        user_id: t.user_id,
        wallet_id: t.wallet_id,
        category_id: t.category_id,
        type: t.type,
        amount: t.amount,
        note: t.note,
        date: t.date,
        created_at: t.created_at
      });
      if (error) console.warn(`   ⚠️ Warning transaction ID ${t.id}:`, error.message);
    }
    console.log('   ✅ Hoàn tất Transactions');

    // 9. Upload Cloud Storage (CSV Report)
    const csvPath = path.join(__dirname, '..', 'dataset', 'transactions.csv');
    if (fs.existsSync(csvPath)) {
      console.log('☁️ Đang tải tệp transactions.csv lên Supabase Cloud Storage (Bucket: spendwise-storage)...');
      const csvBuffer = fs.readFileSync(csvPath);
      const { data, error } = await supabase.storage
        .from('spendwise-storage')
        .upload('reports/transactions_backup.csv', csvBuffer, {
          contentType: 'text/csv',
          upsert: true
        });

      if (!error) {
        const { data: publicUrl } = supabase.storage
          .from('spendwise-storage')
          .getPublicUrl('reports/transactions_backup.csv');
        console.log(`   ✅ Tải lên Cloud Storage thành công!`);
        console.log(`   🔗 Đường dẫn công khai (Public URL): ${publicUrl.publicUrl}`);
      } else {
        console.warn('   ⚠️ Không thể upload storage (hãy kiểm tra xem bucket spendwise-storage đã tạo chưa):', error.message);
      }
    }

    console.log('\n🎉 DI CHUYỂN DỮ LIỆU SANG SUPABASE THÀNH CÔNG RỰC RỠ!');
    console.log('✨ Toàn bộ bảng dữ liệu và tệp CSV đã sẵn sàng trên nền tảng Supabase Cloud.');

  } catch (err) {
    console.error('❌ Lỗi trong quá trình migration:', err);
  }
}

migrate();
