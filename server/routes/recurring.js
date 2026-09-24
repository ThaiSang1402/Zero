const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Helper: flatten Supabase nested join result
function flattenRecurring(r) {
  return {
    ...r,
    category_name: r.categories?.name,
    category_icon: r.categories?.icon,
    category_color: r.categories?.color,
    wallet_name: r.wallets?.name,
    wallet_icon: r.wallets?.icon,
    categories: undefined,
    wallets: undefined,
  };
}

// GET /api/recurring — Lấy danh sách giao dịch định kỳ của user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('recurring_transactions')
      .select('*, categories(name, icon, color), wallets(name, icon)')
      .eq('user_id', req.user.id)
      .order('day_of_month', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(flattenRecurring));
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/recurring — Tạo quy tắc giao dịch định kỳ mới
router.post('/', async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, note, day_of_month = 1 } = req.body;
    if (!category_id || !type || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ danh mục, loại và số tiền hợp lệ (> 0).' });
    }

    const { data, error } = await supabase.from('recurring_transactions').insert({
      user_id: req.user.id,
      wallet_id: wallet_id || null,
      category_id,
      type,
      amount: Number(amount),
      note: note || null,
      day_of_month: Number(day_of_month) || 1,
    }).select('*, categories(name, icon, color), wallets(name, icon)').single();

    if (error) throw error;
    res.status(201).json(flattenRecurring(data));
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/recurring/:id/execute — Ghi nhận nhanh 1 giao dịch từ quy tắc định kỳ
router.post('/:id/execute', async (req, res) => {
  try {
    const { data: rule, error: findErr } = await supabase.from('recurring_transactions').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc giao dịch định kỳ.' });

    const todayStr = new Date().toISOString().slice(0, 10);
    const numAmount = Number(rule.amount);

    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      wallet_id: rule.wallet_id,
      category_id: rule.category_id,
      type: rule.type,
      amount: numAmount,
      note: `[Định kỳ] ${rule.note || ''}`,
      date: todayStr,
    }).select('*, categories(name, icon)').single();

    if (txErr) throw txErr;

    // Cập nhật số dư ví
    if (rule.wallet_id) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', rule.wallet_id).single();
      if (wallet) {
        const balanceChange = rule.type === 'income' ? numAmount : -numAmount;
        await supabase.from('wallets').update({ balance: Number(wallet.balance) + balanceChange }).eq('id', rule.wallet_id);
      }
    }

    res.json({
      message: 'Đã ghi nhận giao dịch định kỳ thành công!',
      transaction: {
        ...tx,
        category_name: tx.categories?.name,
        category_icon: tx.categories?.icon,
        categories: undefined,
      },
    });
  } catch (err) {
    console.error('Execute recurring error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/recurring/:id — Xóa quy tắc định kỳ
router.delete('/:id', async (req, res) => {
  try {
    const { data: rule, error: findErr } = await supabase.from('recurring_transactions').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc định kỳ.' });

    const { error } = await supabase.from('recurring_transactions').delete().eq('id', rule.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa quy tắc định kỳ.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
