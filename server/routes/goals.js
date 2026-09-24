const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/goals — Lấy các mục tiêu tiết kiệm
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('savings_goals').select('*')
      .eq('user_id', req.user.id)
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/goals — Tạo mục tiêu tiết kiệm mới
router.post('/', async (req, res) => {
  try {
    const { name, target_amount, current_amount = 0, deadline, icon, color } = req.body;
    if (!name || !target_amount || Number(target_amount) <= 0) {
      return res.status(400).json({ error: 'Tên mục tiêu và số tiền mục tiêu phải hợp lệ (> 0).' });
    }

    const { data, error } = await supabase.from('savings_goals').insert({
      user_id: req.user.id,
      name,
      target_amount: Number(target_amount),
      current_amount: Number(current_amount) || 0,
      deadline: deadline || null,
      icon: icon || '🎯',
      color: color || '#8b5cf6',
    }).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/goals/:id/deposit — Thêm tiền vào mục tiêu tiết kiệm
router.post('/:id/deposit', async (req, res) => {
  try {
    const { amount, wallet_id } = req.body;
    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount <= 0) return res.status(400).json({ error: 'Số tiền nạp phải lớn hơn 0.' });

    const { data: goal, error: findErr } = await supabase.from('savings_goals').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !goal) return res.status(404).json({ error: 'Không tìm thấy mục tiêu tiết kiệm.' });

    if (wallet_id) {
      const { data: wallet } = await supabase.from('wallets').select('*')
        .eq('id', wallet_id).eq('user_id', req.user.id).single();
      if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví tiền.' });
      if (Number(wallet.balance) < depositAmount) return res.status(400).json({ error: `Số dư ví "${wallet.name}" không đủ.` });
      await supabase.from('wallets').update({ balance: Number(wallet.balance) - depositAmount }).eq('id', wallet.id);
    }

    const { data: updated, error: updateErr } = await supabase.from('savings_goals')
      .update({ current_amount: Number(goal.current_amount) + depositAmount })
      .eq('id', goal.id).select().single();

    if (updateErr) throw updateErr;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/goals/:id — Xóa mục tiêu
router.delete('/:id', async (req, res) => {
  try {
    const { data: goal, error: findErr } = await supabase.from('savings_goals').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !goal) return res.status(404).json({ error: 'Không tìm thấy mục tiêu tiết kiệm.' });

    const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa mục tiêu tiết kiệm.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
