const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/debts — Lấy danh sách nợ & cho vay
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('debts').select('*')
      .eq('user_id', req.user.id)
      .order('is_paid', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// POST /api/debts — Tạo khoản nợ / cho vay mới
router.post('/', async (req, res) => {
  try {
    const { person_name, type, amount, due_date, note } = req.body;
    if (!person_name || !type || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Vui lòng nhập người liên quan, loại khoản tiền và số tiền > 0.' });
    }
    if (!['lend', 'borrow'].includes(type)) {
      return res.status(400).json({ error: 'Loại khoản nợ không hợp lệ.' });
    }

    const { data, error } = await supabase.from('debts').insert({
      user_id: req.user.id,
      person_name,
      type,
      amount: Number(amount),
      due_date: due_date || null,
      note: note || null,
      is_paid: 0,
    }).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// PATCH /api/debts/:id/toggle-paid — Đánh dấu đã trả / thu xong nợ
router.patch('/:id/toggle-paid', async (req, res) => {
  try {
    const { data: debt, error: findErr } = await supabase.from('debts').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !debt) return res.status(404).json({ error: 'Không tìm thấy thông tin vay/nợ.' });

    const { data, error } = await supabase.from('debts')
      .update({ is_paid: debt.is_paid === 1 ? 0 : 1 })
      .eq('id', debt.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// DELETE /api/debts/:id — Xóa khoản nợ
router.delete('/:id', async (req, res) => {
  try {
    const { data: debt, error: findErr } = await supabase.from('debts').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (findErr || !debt) return res.status(404).json({ error: 'Không tìm thấy thông tin vay/nợ.' });

    const { error } = await supabase.from('debts').delete().eq('id', debt.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa khoản nợ thành công.' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
