const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function getMonthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const start = `${year}-${String(m).padStart(2, '0')}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? year + 1 : year;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end };
}

// GET /api/budgets?month=YYYY-MM — Lấy danh sách hạn mức ngân sách tháng + số tiền đã chi thực tế
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, end } = getMonthRange(month);

    const { data: budgets, error } = await supabase.from('budgets')
      .select('*, categories(name, icon, color)')
      .eq('user_id', userId)
      .eq('month', month)
      .order('amount_limit', { ascending: false });

    if (error) throw error;

    // Tính toán số tiền đã chi thực tế cho từng danh mục
    const { data: txs } = await supabase.from('transactions')
      .select('category_id, amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', start)
      .lt('date', end);

    const spentMap = {};
    for (const t of txs || []) {
      spentMap[t.category_id] = (spentMap[t.category_id] || 0) + Number(t.amount);
    }

    const result = (budgets || []).map(b => ({
      ...b,
      category_name: b.categories?.name,
      category_icon: b.categories?.icon,
      category_color: b.categories?.color,
      spent_amount: spentMap[b.category_id] || 0,
      categories: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET budgets error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/budgets — Đặt / Cập nhật ngân sách cho danh mục
router.post('/', async (req, res) => {
  try {
    const { category_id, amount_limit, month } = req.body;
    if (!category_id || !amount_limit || Number(amount_limit) <= 0 || !month) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ danh mục, tháng và hạn mức > 0.' });
    }

    const userId = req.user.id;
    const { data: existing } = await supabase.from('budgets').select('id')
      .eq('user_id', userId).eq('category_id', category_id).eq('month', month).maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase.from('budgets')
        .update({ amount_limit: Number(amount_limit) })
        .eq('id', existing.id).select().single();
      if (error) throw error;
      result = data;
      return res.json(result);
    } else {
      const { data, error } = await supabase.from('budgets')
        .insert({ user_id: userId, category_id, amount_limit: Number(amount_limit), month })
        .select().single();
      if (error) throw error;
      result = data;
      return res.status(201).json(result);
    }
  } catch (err) {
    console.error('POST budgets error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/budgets/:id — Xóa ngân sách
router.delete('/:id', async (req, res) => {
  try {
    const { data: budget, error: findErr } = await supabase.from('budgets').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !budget) return res.status(404).json({ error: 'Không tìm thấy ngân sách.' });

    const { error } = await supabase.from('budgets').delete().eq('id', budget.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa ngân sách thành công.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
