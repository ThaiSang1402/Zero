const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Helper: flatten Supabase nested join result
function flattenTx(t) {
  if (!t) return t;
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

// Helper: get date range for a month string (YYYY-MM)
function getMonthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const start = `${year}-${String(m).padStart(2, '0')}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? year + 1 : year;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end };
}

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { month, category_id, wallet_id, type, limit = 200, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = supabase.from('transactions')
      .select('*, categories(name, icon, color), wallets(name, icon)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (month) {
      const { start, end } = getMonthRange(month);
      query = query.gte('date', start).lt('date', end);
    }
    if (category_id) query = query.eq('category_id', category_id);
    if (wallet_id) query = query.eq('wallet_id', wallet_id);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(flattenTx));
  } catch (err) {
    console.error('GET transactions error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { wallet_id, category_id, type, amount, note, date } = req.body;
    const userId = req.user.id;

    if (!category_id || !type || !amount || !date)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (danh mục, loại, số tiền, ngày).' });
    if (!['income', 'expense'].includes(type))
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ.' });
    if (Number(amount) <= 0)
      return res.status(400).json({ error: 'Số tiền phải lớn hơn 0.' });

    const { data: category } = await supabase.from('categories').select('id').eq('id', category_id).maybeSingle();
    if (!category) return res.status(400).json({ error: 'Danh mục không tồn tại.' });

    let selectedWalletId = wallet_id || null;
    if (!selectedWalletId) {
      const { data: firstWallet } = await supabase.from('wallets').select('id').eq('user_id', userId).limit(1).maybeSingle();
      selectedWalletId = firstWallet?.id || null;
    }

    const numAmount = Number(amount);
    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: selectedWalletId,
      category_id,
      type,
      amount: numAmount,
      note: note || null,
      date,
    }).select('*, categories(name, icon, color), wallets(name, icon)').single();

    if (txErr) throw txErr;

    // Cập nhật số dư ví
    if (selectedWalletId) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', selectedWalletId).single();
      if (wallet) {
        const balanceChange = type === 'income' ? numAmount : -numAmount;
        await supabase.from('wallets').update({ balance: Number(wallet.balance) + balanceChange }).eq('id', selectedWalletId);
      }
    }

    res.status(201).json(flattenTx(tx));
  } catch (err) {
    console.error('POST transactions error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { data: tx, error: findErr } = await supabase
      .from('transactions').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

    const { wallet_id, category_id, type, amount, note, date } = req.body;
    const newType = type || tx.type;
    const newAmount = amount !== undefined ? Number(amount) : tx.amount;
    const newWalletId = wallet_id !== undefined ? wallet_id : tx.wallet_id;

    // Hoàn lại số dư ví cũ
    if (tx.wallet_id) {
      const { data: oldWallet } = await supabase.from('wallets').select('balance').eq('id', tx.wallet_id).single();
      if (oldWallet) {
        const oldRevert = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
        await supabase.from('wallets').update({ balance: Number(oldWallet.balance) + oldRevert }).eq('id', tx.wallet_id);
      }
    }

    // Cập nhật giao dịch
    const { data: updated, error: updateErr } = await supabase.from('transactions').update({
      wallet_id: newWalletId,
      category_id: category_id || tx.category_id,
      type: newType,
      amount: newAmount,
      note: note !== undefined ? note : tx.note,
      date: date || tx.date,
    }).eq('id', tx.id).eq('user_id', req.user.id)
      .select('*, categories(name, icon, color), wallets(name, icon)').single();

    if (updateErr) throw updateErr;

    // Áp dụng số dư ví mới
    if (newWalletId) {
      const { data: newWallet } = await supabase.from('wallets').select('balance').eq('id', newWalletId).single();
      if (newWallet) {
        const newApply = newType === 'income' ? newAmount : -newAmount;
        await supabase.from('wallets').update({ balance: Number(newWallet.balance) + newApply }).eq('id', newWalletId);
      }
    }

    res.json(flattenTx(updated));
  } catch (err) {
    console.error('PUT transactions error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: tx, error: findErr } = await supabase
      .from('transactions').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !tx) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });

    // Hoàn lại số dư ví
    if (tx.wallet_id) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', tx.wallet_id).single();
      if (wallet) {
        const revert = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
        await supabase.from('wallets').update({ balance: Number(wallet.balance) + revert }).eq('id', tx.wallet_id);
      }
    }

    await supabase.from('transactions').delete().eq('id', tx.id);
    res.json({ message: 'Đã xóa giao dịch thành công.' });
  } catch (err) {
    console.error('DELETE transactions error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
