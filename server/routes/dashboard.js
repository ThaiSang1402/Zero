const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function flattenTx(t) {
  return {
    ...t,
    category_name: t.categories?.name,
    category_icon: t.categories?.icon,
    category_color: t.categories?.color,
    wallet_name: t.wallets?.name,
    wallet_icon: t.wallets?.icon,
    categories: undefined,
    wallets: undefined,
  };
}

function getMonthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const start = `${year}-${String(m).padStart(2, '0')}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? year + 1 : year;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end };
}

// GET /api/dashboard/summary?month=YYYY-MM
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const monthFilter = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(monthFilter);

    // Tổng số dư tất cả ví (Net worth)
    const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId).order('id');
    const netWorth = (wallets || []).reduce((sum, w) => sum + Number(w.balance), 0);

    // Giao dịch trong tháng
    const { data: monthTxs } = await supabase.from('transactions')
      .select('*, categories(name, icon, color), wallets(name, icon)')
      .eq('user_id', userId)
      .gte('date', start)
      .lt('date', end);

    const totalIncome = (monthTxs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = (monthTxs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // Chi theo danh mục
    const catMap = {};
    for (const t of monthTxs || []) {
      const cid = t.category_id;
      if (!catMap[cid]) {
        catMap[cid] = { id: cid, name: t.categories?.name, icon: t.categories?.icon, color: t.categories?.color, type: t.type, total: 0, count: 0 };
      }
      catMap[cid].total += Number(t.amount);
      catMap[cid].count++;
    }
    const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total);

    // Thu chi 6 tháng gần nhất (cho biểu đồ)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

    const { data: allTxs } = await supabase.from('transactions')
      .select('type, amount, date')
      .eq('user_id', userId)
      .gte('date', sixMonthsAgoStr);

    const monthlyMap = {};
    for (const t of allTxs || []) {
      const m = t.date.slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, income: 0, expense: 0 };
      if (t.type === 'income') monthlyMap[m].income += Number(t.amount);
      else monthlyMap[m].expense += Number(t.amount);
    }
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // 5 giao dịch mới nhất
    const { data: recentTxs } = await supabase.from('transactions')
      .select('*, categories(name, icon, color), wallets(name, icon)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    // Cảnh báo Ngân sách
    const alerts = [];
    const today = new Date().toISOString().slice(0, 10);

    const { data: budgets } = await supabase.from('budgets')
      .select('*, categories(name, icon, color)')
      .eq('user_id', userId)
      .eq('month', monthFilter);

    for (const b of budgets || []) {
      const spent = (monthTxs || [])
        .filter(t => t.category_id === b.category_id && t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0);
      const pct = Math.round((spent / b.amount_limit) * 100);
      if (pct >= 100) {
        alerts.push({ id: `b-exp-${b.id}`, type: 'error', title: '🚨 Vượt hạn mức Ngân sách!', message: `Danh mục ${b.categories?.icon} ${b.categories?.name} đã vượt ${pct}% ngân sách (${spent.toLocaleString('vi-VN')}₫ / ${Number(b.amount_limit).toLocaleString('vi-VN')}₫).` });
      } else if (pct >= 80) {
        alerts.push({ id: `b-warn-${b.id}`, type: 'warning', title: '⚠️ Cảnh báo Ngân sách', message: `Danh mục ${b.categories?.icon} ${b.categories?.name} đã chi ${pct}% hạn mức tháng này.` });
      }
    }

    // Cảnh báo Vay & Nợ sắp đến hạn
    const { data: pendingDebts } = await supabase.from('debts')
      .select('*').eq('user_id', userId).eq('is_paid', 0).not('due_date', 'is', null);

    const soonDate = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    for (const d of pendingDebts || []) {
      if (d.due_date < today) {
        alerts.push({ id: `d-over-${d.id}`, type: 'error', title: '⏰ Khoản Nợ Quá Hạn!', message: `${d.type === 'lend' ? 'Người dùng ' + d.person_name + ' chưa trả' : 'Bạn chưa trả khoản nợ ' + d.person_name} số tiền ${Number(d.amount).toLocaleString('vi-VN')}₫ (Hạn: ${d.due_date}).` });
      } else if (d.due_date <= soonDate) {
        alerts.push({ id: `d-due-${d.id}`, type: 'info', title: '📅 Sắp Đến Hạn Trả Nợ', message: `Khoản nợ với ${d.person_name} (${Number(d.amount).toLocaleString('vi-VN')}₫) sắp tới hạn ngày ${d.due_date}.` });
      }
    }

    res.json({
      month: monthFilter,
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        total_count: (monthTxs || []).length,
        net_worth: netWorth,
      },
      alerts,
      wallets: wallets || [],
      by_category: byCategory,
      monthly_chart: monthly,
      recent_transactions: (recentTxs || []).map(flattenTx),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// GET /api/dashboard/categories
router.get('/categories', async (req, res) => {
  try {
    const { type } = req.query;
    let query = supabase.from('categories').select('*').order('type').order('name');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
