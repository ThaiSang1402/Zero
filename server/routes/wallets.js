const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/wallets — Lấy tất cả ví tiền của user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets').select('*')
      .eq('user_id', req.user.id)
      .order('id');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/wallets — Tạo ví mới
router.post('/', async (req, res) => {
  try {
    const { name, type, balance = 0, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên ví không được để trống.' });

    const { data, error } = await supabase.from('wallets').insert({
      user_id: req.user.id,
      name,
      type: type || 'cash',
      balance: Number(balance) || 0,
      icon: icon || '💵',
      color: color || '#10b981',
    }).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PUT /api/wallets/:id — Sửa thông tin ví
router.put('/:id', async (req, res) => {
  try {
    const { data: wallet, error: findErr } = await supabase
      .from('wallets').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id)
      .single();
    if (findErr || !wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });

    const { name, type, balance, icon, color } = req.body;
    const { data, error } = await supabase.from('wallets').update({
      name: name || wallet.name,
      type: type || wallet.type,
      balance: balance !== undefined ? Number(balance) : wallet.balance,
      icon: icon || wallet.icon,
      color: color || wallet.color,
    }).eq('id', wallet.id).eq('user_id', req.user.id).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/wallets/:id — Xóa ví
router.delete('/:id', async (req, res) => {
  try {
    const { data: wallet, error: findErr } = await supabase
      .from('wallets').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id)
      .single();
    if (findErr || !wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });

    const { error } = await supabase.from('wallets').delete().eq('id', wallet.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa ví tiền thành công.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/wallets/transfer — Chuyển tiền giữa 2 ví
router.post('/transfer', async (req, res) => {
  try {
    const { from_wallet_id, to_wallet_id, amount } = req.body;
    if (!from_wallet_id || !to_wallet_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Vui lòng chọn đầy đủ ví và số tiền chuyển hợp lệ.' });
    }
    if (String(from_wallet_id) === String(to_wallet_id)) {
      return res.status(400).json({ error: 'Ví nguồn và ví đích phải khác nhau.' });
    }

    const { data: fromWallet } = await supabase.from('wallets').select('*').eq('id', from_wallet_id).eq('user_id', req.user.id).single();
    const { data: toWallet } = await supabase.from('wallets').select('*').eq('id', to_wallet_id).eq('user_id', req.user.id).single();

    if (!fromWallet || !toWallet) return res.status(404).json({ error: 'Không tìm thấy thông tin ví.' });

    const transferAmount = Number(amount);
    if (fromWallet.balance < transferAmount) {
      return res.status(400).json({ error: `Số dư ví "${fromWallet.name}" không đủ để chuyển.` });
    }

    await supabase.from('wallets').update({ balance: Number(fromWallet.balance) - transferAmount }).eq('id', fromWallet.id);
    await supabase.from('wallets').update({ balance: Number(toWallet.balance) + transferAmount }).eq('id', toWallet.id);

    res.json({ message: `Đã chuyển ₫${transferAmount.toLocaleString('vi-VN')} từ "${fromWallet.name}" sang "${toWallet.name}".` });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
