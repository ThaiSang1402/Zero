-- ====================================================================
-- 💎 SPENDWISE PERSONAL - SUPABASE POSTGRESQL SCHEMA & STORAGE SETUP
-- Hướng dẫn: Copy toàn bộ nội dung file này vào Supabase -> SQL Editor -> Run
-- ====================================================================

-- 1. BẢNG USERS (Người dùng)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG CATEGORIES (Danh mục thu/chi)
CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  icon VARCHAR(50) DEFAULT '📁',
  color VARCHAR(50) DEFAULT '#6b7280'
);

-- 3. BẢNG WALLETS (Ví tài chính & Tài khoản)
CREATE TABLE IF NOT EXISTS public.wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'cash',
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  icon VARCHAR(50) DEFAULT '💵',
  color VARCHAR(50) DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG TRANSACTIONS (Giao dịch thu/chi)
CREATE TABLE IF NOT EXISTS public.transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id BIGINT REFERENCES public.wallets(id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL REFERENCES public.categories(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BẢNG BUDGETS (Ngân sách chi tiêu tháng)
CREATE TABLE IF NOT EXISTS public.budgets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES public.categories(id),
  amount_limit NUMERIC(15, 2) NOT NULL CHECK (amount_limit > 0),
  month VARCHAR(7) NOT NULL, -- Định dạng YYYY-MM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month)
);

-- 6. BẢNG SAVINGS_GOALS (Mục tiêu tiết kiệm)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL,
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  deadline DATE,
  icon VARCHAR(50) DEFAULT '🎯',
  color VARCHAR(50) DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BẢNG DEBTS (Sổ theo dõi Vay & Nợ)
CREATE TABLE IF NOT EXISTS public.debts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  person_name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('lend', 'borrow')),
  amount NUMERIC(15, 2) NOT NULL,
  due_date DATE,
  note TEXT,
  is_paid INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BẢNG RECURRING_TRANSACTIONS (Giao dịch định kỳ)
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id BIGINT REFERENCES public.wallets(id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL REFERENCES public.categories(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(15, 2) NOT NULL,
  note TEXT,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TẠO INDEXES TĂNG TỐC TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month);

-- 10. TẠO BUCKET CLOUD STORAGE ĐỂ LƯU TỆP BÁO CÁO & CSV
INSERT INTO storage.buckets (id, name, public)
VALUES ('spendwise-storage', 'spendwise-storage', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép truy cập công khai vào file trong bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'spendwise-storage');

-- Cho phép upload vào bucket
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spendwise-storage');

-- ====================================================================
-- DỮ LIỆU DANH MỤC MẪU (DEFAULT CATEGORIES)
-- ====================================================================
INSERT INTO public.categories (name, type, icon, color) VALUES
  ('Lương', 'income', '💼', '#10b981'),
  ('Freelance', 'income', '💻', '#06b6d4'),
  ('Đầu tư', 'income', '📈', '#8b5cf6'),
  ('Thưởng', 'income', '🎁', '#f59e0b'),
  ('Khác (Thu)', 'income', '💵', '#64748b'),
  ('Ăn uống', 'expense', '🍜', '#f97316'),
  ('Di chuyển', 'expense', '🚗', '#3b82f6'),
  ('Mua sắm', 'expense', '🛍️', '#ec4899'),
  ('Giải trí', 'expense', '🎮', '#a855f7'),
  ('Y tế', 'expense', '🏥', '#ef4444'),
  ('Giáo dục', 'expense', '📚', '#14b8a6'),
  ('Hóa đơn', 'expense', '🧾', '#64748b'),
  ('Nhà ở', 'expense', '🏠', '#78716c'),
  ('Khác (Chi)', 'expense', '📦', '#94a3b8')
ON CONFLICT DO NOTHING;
