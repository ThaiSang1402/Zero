/* ================================================================
   SpendWise Personal — Full SPA JavaScript
   Auth · Routing · Dashboard · Transactions · Wallets
   Budgets · Savings Goals · Debts · Recurring · Smart Alerts · Charts
   ================================================================ */

const API = '';

// ── STATE ────────────────────────────────────────────────────────
let token = localStorage.getItem('sw_token') || null;
let currentUser = JSON.parse(localStorage.getItem('sw_user') || 'null');
let currentPage = 'dashboard';
let currentMonth = new Date().toISOString().slice(0, 7);
let allCategories = [];
let allWallets = [];
let currentTxType = 'expense';
let currentRecType = 'expense';
let pendingDeleteId = null;
let pendingDeleteType = 'transaction';
let monthlyChart = null, pieChart = null, barChart = null;

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (token && currentUser) {
    await showApp();
  } else {
    showAuth();
  }
});

// ── AUTH ─────────────────────────────────────────────────────────
function showAuth() {
  document.getElementById('auth-view').style.display = 'block';
  document.getElementById('app-view').style.display = 'none';
}

async function showApp() {
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'block';

  try {
    const freshUser = await apiGet('/api/auth/me');
    currentUser = { ...currentUser, ...freshUser };
    localStorage.setItem('sw_user', JSON.stringify(currentUser));
  } catch (_) {}

  updateSidebarUser();
  await Promise.all([loadCategories(), loadWallets()]);
  updateMonthDisplay();
  navigateTo('dashboard');
}

function updateSidebarUser() {
  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-email').textContent = currentUser.email;
  document.getElementById('user-avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('sidebar-role-badge').textContent = 'Personal';
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-alert').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  setAuthLoading(true, 'login');
  try {
    const res = await apiPost('/api/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_user', JSON.stringify(currentUser));
    await showApp();
    showToast('✅ Chào mừng ' + currentUser.name + '!', 'success');
  } catch (err) {
    showAuthAlert(err.message);
  } finally {
    setAuthLoading(false, 'login');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  setAuthLoading(true, 'register');
  try {
    const res = await apiPost('/api/auth/register', {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_user', JSON.stringify(currentUser));
    await showApp();
    showToast('🎉 Tạo tài khoản cá nhân thành công!', 'success');
  } catch (err) {
    showAuthAlert(err.message);
  } finally {
    setAuthLoading(false, 'register');
  }
}

function handleLogout() {
  token = null; currentUser = null;
  localStorage.removeItem('sw_token');
  localStorage.removeItem('sw_user');
  destroyCharts();
  showAuth();
  showToast('👋 Đã đăng xuất', 'info');
}

function showAuthAlert(msg) {
  const el = document.getElementById('auth-alert');
  el.style.display = 'flex';
  el.className = 'alert alert-error';
  el.innerHTML = '⚠️ ' + msg;
}

function setAuthLoading(loading, form) {
  const btn = document.getElementById(form + '-btn');
  const text = document.getElementById(form + '-btn-text');
  btn.disabled = loading;
  text.innerHTML = loading ? '<div class="spinner"></div>' : (form === 'login' ? 'Đăng nhập' : 'Tạo tài khoản');
}

// ── NAVIGATION ───────────────────────────────────────────────────
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  if (page === 'dashboard') loadDashboard();
  else if (page === 'transactions') loadTransactions();
  else if (page === 'wallets') loadWalletsPage();
  else if (page === 'budgets') loadBudgetsPage();
  else if (page === 'goals') loadGoalsPage();
  else if (page === 'debts') loadDebtsPage();
  else if (page === 'recurring') loadRecurringPage();
  else if (page === 'analytics') loadAnalytics();
}

function changeMonth(delta) {
  const [y, m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  updateMonthDisplay();
  if (currentPage === 'dashboard') loadDashboard();
  else if (currentPage === 'budgets') loadBudgetsPage();
}

function updateMonthDisplay() {
  const [y, m] = currentMonth.split('-').map(Number);
  const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  const el = document.getElementById('month-display');
  if (el) el.textContent = `${months[m-1]} ${y}`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `T${m}/${y}`;
}

// ── DATA LOADERS ─────────────────────────────────────────────────
async function loadCategories() {
  try {
    allCategories = await apiGet('/api/dashboard/categories');
    updateModalCategories('expense');
    const filterCat = document.getElementById('filter-category');
    if (filterCat) {
      filterCat.innerHTML = '<option value="">Tất cả danh mục</option>' + 
        allCategories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    }
  } catch (_) {}
}

async function loadWallets() {
  try {
    allWallets = await apiGet('/api/wallets');
    populateWalletSelects();
  } catch (_) {}
}

function populateWalletSelects() {
  const txWallet = document.getElementById('tx-wallet');
  const recWallet = document.getElementById('rec-wallet');
  const filterWallet = document.getElementById('filter-wallet');
  const transferFrom = document.getElementById('transfer-from');
  const transferTo = document.getElementById('transfer-to');
  const depositWallet = document.getElementById('deposit-wallet');

  const optionsHTML = allWallets.map(w => `<option value="${w.id}">${w.icon} ${w.name} (${formatCurrency(w.balance)})</option>`).join('');

  if (txWallet) txWallet.innerHTML = optionsHTML;
  if (recWallet) recWallet.innerHTML = optionsHTML;
  if (depositWallet) depositWallet.innerHTML = optionsHTML;
  if (transferFrom) transferFrom.innerHTML = optionsHTML;
  if (transferTo) transferTo.innerHTML = optionsHTML;
  if (filterWallet) filterWallet.innerHTML = '<option value="">Tất cả Ví tiền</option>' + optionsHTML;
}

function updateModalCategories(type) {
  const sel = document.getElementById('tx-category');
  if (!sel) return;
  const filtered = allCategories.filter(c => c.type === type);
  sel.innerHTML = filtered.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

// ── DASHBOARD & SMART ALERTS ─────────────────────────────────────
async function loadDashboard() {
  updateMonthDisplay();
  try {
    const data = await apiGet(`/api/dashboard/summary?month=${currentMonth}`);
    const { total_income, total_expense, net_worth, total_count } = data.summary;

    document.getElementById('stat-networth').textContent = formatCurrency(net_worth);
    document.getElementById('stat-income').textContent = formatCurrency(total_income);
    document.getElementById('stat-expense').textContent = formatCurrency(total_expense);
    document.getElementById('stat-count').textContent = total_count;

    renderSmartAlerts(data.alerts);
    renderWalletsGrid(data.wallets, 'dashboard-wallets', false);
    renderMonthlyChart(data.monthly_chart);
    renderCategoryBreakdown(data.by_category.filter(c => c.type === 'expense'), total_expense);
    renderTransactionList(data.recent_transactions, 'recent-transactions', false);
  } catch (err) {
    showToast('❌ Không tải được dashboard', 'error');
  }
}

function renderSmartAlerts(alerts) {
  const container = document.getElementById('dashboard-alerts');
  if (!container) return;
  if (!alerts || !alerts.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = alerts.map(a => `
    <div class="alert alert-${a.type === 'error' ? 'error' : (a.type === 'warning' ? 'warning' : 'info')}" style="margin-bottom:0">
      <div style="font-weight:700">${a.title}</div>
      <div style="font-size:13px">${a.message}</div>
    </div>`).join('');
}

function renderWalletsGrid(wallets, containerId, showActions = true) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!wallets || !wallets.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👛</div><h3>Chưa có ví nào</h3></div>`;
    return;
  }
  container.innerHTML = wallets.map(w => `
    <div class="wallet-card" style="border-top:3px solid ${w.color || '#10b981'}">
      <div class="wallet-card-header">
        <div class="wallet-card-icon" style="background:${w.color || '#10b981'}22">${w.icon || '💵'}</div>
        <div class="wallet-card-type">${w.type}</div>
      </div>
      <div class="wallet-card-name">${w.name}</div>
      <div class="wallet-card-balance" style="color:${w.balance < 0 ? 'var(--red)' : 'var(--text-primary)'}">${formatCurrency(w.balance)}</div>
      ${showActions ? `
        <div class="wallet-card-actions">
          <button class="btn btn-ghost btn-sm" onclick='openEditWalletModal(${JSON.stringify(w)})'>✏️ Sửa</button>
          <button class="btn btn-ghost btn-sm" onclick="openDeleteConfirm(${w.id}, 'wallet')" style="color:var(--red)">🗑️ Xóa</button>
        </div>` : ''}
    </div>`).join('');
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('monthly-chart')?.getContext('2d');
  if (!ctx) return;
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => getMonthLabel(d.month)),
      datasets: [
        { label: 'Thu nhập', data: data.map(d => d.income), backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1.5, borderRadius: 6 },
        { label: 'Chi tiêu', data: data.map(d => d.expense), backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', callback: v => formatCurrency(v) } }
      }
    }
  });
}

function renderCategoryBreakdown(categories, total) {
  const container = document.getElementById('cat-breakdown');
  if (!container) return;
  if (!categories.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">Chưa có chi tiêu tháng này</p>'; return; }
  const maxVal = Math.max(...categories.map(c => c.total), 1);
  container.innerHTML = categories.slice(0, 6).map(c => `
    <div class="cat-item">
      <div class="cat-icon-wrap" style="background:${c.color}22">${c.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${c.name} <small style="color:var(--text-muted)">${total > 0 ? Math.round(c.total/total*100) : 0}%</small></div>
        <div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.round(c.total/maxVal*100)}%;background:${c.color}"></div></div>
      </div>
      <div class="cat-amount">${formatCurrency(c.total)}</div>
    </div>`).join('');
}

// ── TRANSACTIONS ─────────────────────────────────────────────────
async function loadTransactions() {
  const container = document.getElementById('transactions-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-wrap"><div class="loading-spinner"></div></div>';
  const month = document.getElementById('filter-month')?.value || '';
  const type = document.getElementById('filter-type')?.value || '';
  const walletId = document.getElementById('filter-wallet')?.value || '';
  const catId = document.getElementById('filter-category')?.value || '';

  let url = '/api/transactions?limit=200';
  if (month) url += `&month=${month}`;
  if (type) url += `&type=${type}`;
  if (walletId) url += `&wallet_id=${walletId}`;
  if (catId) url += `&category_id=${catId}`;

  try {
    const txs = await apiGet(url);
    renderTransactionList(txs, 'transactions-list', true);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Lỗi tải dữ liệu</h3><p>${err.message}</p></div>`;
  }
}

function renderTransactionList(txs, containerId, showActions = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!txs || !txs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><h3>Chưa có giao dịch</h3><p>Nhấn "Thêm giao dịch" để bắt đầu.</p></div>`;
    return;
  }
  container.innerHTML = txs.map(tx => `
    <div class="tx-item" id="tx-${tx.id}">
      <div class="tx-icon" style="background:${tx.category_color}22">${tx.category_icon}</div>
      <div class="tx-info">
        <div class="tx-category">${tx.category_name} ${tx.wallet_name ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg-input);color:var(--text-secondary)">${tx.wallet_icon || '👛'} ${tx.wallet_name}</span>` : ''}</div>
        <div class="tx-note">${tx.note || '—'}</div>
      </div>
      <div class="tx-date">${formatDate(tx.date)}</div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</div>
      ${showActions ? `
        <div class="tx-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Sửa" onclick="openEditModal(${tx.id})">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Xóa" onclick="openDeleteConfirm(${tx.id},'transaction')" style="color:var(--red)">🗑️</button>
        </div>` : ''}
    </div>`).join('');
}

function clearFilters() {
  ['filter-month','filter-type','filter-wallet','filter-category'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  loadTransactions();
}

// ── WALLETS PAGE ─────────────────────────────────────────────────
async function loadWalletsPage() {
  await loadWallets();
  renderWalletsGrid(allWallets, 'wallets-grid', true);
}

function openAddWalletModal() {
  document.getElementById('wallet-modal-title').textContent = '👛 Thêm Ví Mới';
  document.getElementById('edit-wallet-id').value = '';
  document.getElementById('wallet-form').reset();
  document.getElementById('wallet-overlay').style.display = 'flex';
}

function openEditWalletModal(w) {
  document.getElementById('wallet-modal-title').textContent = '✏️ Sửa Ví Tiền';
  document.getElementById('edit-wallet-id').value = w.id;
  document.getElementById('wallet-name').value = w.name;
  document.getElementById('wallet-type').value = w.type;
  document.getElementById('wallet-icon').value = w.icon || '💵';
  document.getElementById('wallet-balance').value = w.balance;
  document.getElementById('wallet-color').value = w.color || '#10b981';
  document.getElementById('wallet-overlay').style.display = 'flex';
}

function closeWalletModal() { document.getElementById('wallet-overlay').style.display = 'none'; }

async function handleSubmitWallet(e) {
  e.preventDefault();
  const id = document.getElementById('edit-wallet-id').value;
  const body = {
    name: document.getElementById('wallet-name').value,
    type: document.getElementById('wallet-type').value,
    icon: document.getElementById('wallet-icon').value,
    balance: Number(document.getElementById('wallet-balance').value),
    color: document.getElementById('wallet-color').value,
  };
  try {
    if (id) {
      await apiPut(`/api/wallets/${id}`, body);
      showToast('✅ Đã cập nhật thông tin ví', 'success');
    } else {
      await apiPost('/api/wallets', body);
      showToast('✅ Đã tạo ví mới', 'success');
    }
    closeWalletModal();
    await loadWallets();
    if (currentPage === 'wallets') loadWalletsPage();
    else if (currentPage === 'dashboard') loadDashboard();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── TRANSFER MODAL ───────────────────────────────────────────────
function openTransferModal() {
  populateWalletSelects();
  document.getElementById('transfer-overlay').style.display = 'flex';
}
function closeTransferModal() { document.getElementById('transfer-overlay').style.display = 'none'; }

async function handleSubmitTransfer(e) {
  e.preventDefault();
  const body = {
    from_wallet_id: Number(document.getElementById('transfer-from').value),
    to_wallet_id: Number(document.getElementById('transfer-to').value),
    amount: Number(document.getElementById('transfer-amount').value),
  };
  try {
    const res = await apiPost('/api/wallets/transfer', body);
    showToast(res.message, 'success');
    closeTransferModal();
    await loadWallets();
    if (currentPage === 'dashboard') loadDashboard();
    else if (currentPage === 'wallets') loadWalletsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── BUDGETS PAGE ─────────────────────────────────────────────────
async function loadBudgetsPage() {
  const container = document.getElementById('budgets-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-wrap"><div class="loading-spinner"></div></div>';
  try {
    const budgets = await apiGet(`/api/budgets?month=${currentMonth}`);
    if (!budgets || !budgets.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h3>Chưa có hạn mức ngân sách</h3><p>Nhấn "Đặt hạn mức mới" để quản lý chi tiêu.</p></div>`;
      return;
    }
    container.innerHTML = budgets.map(b => {
      const pct = Math.min(Math.round((b.spent_amount / b.amount_limit) * 100), 100);
      let color = 'var(--green)';
      if (pct > 70 && pct <= 90) color = 'var(--yellow)';
      if (pct > 90) color = 'var(--red)';

      return `
        <div class="budget-card">
          <div class="budget-header">
            <div class="budget-cat">
              <span style="font-size:24px">${b.category_icon}</span>
              <span>${b.category_name}</span>
            </div>
            <div class="budget-amounts">
              <span style="color:${color}">${formatCurrency(b.spent_amount)}</span> / ${formatCurrency(b.amount_limit)}
            </div>
          </div>
          <div class="budget-progress-track">
            <div class="budget-progress-bar" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="budget-footer">
            <span>Đã dùng ${pct}% hạn mức</span>
            <button class="btn btn-ghost btn-sm" onclick="deleteBudget(${b.id})" style="color:var(--red)">Xóa</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openAddBudgetModal() {
  const sel = document.getElementById('budget-category');
  if (sel) {
    const expenses = allCategories.filter(c => c.type === 'expense');
    sel.innerHTML = expenses.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }
  document.getElementById('budget-overlay').style.display = 'flex';
}
function closeBudgetModal() { document.getElementById('budget-overlay').style.display = 'none'; }

async function handleSubmitBudget(e) {
  e.preventDefault();
  const body = {
    category_id: Number(document.getElementById('budget-category').value),
    amount_limit: Number(document.getElementById('budget-limit').value),
    month: currentMonth,
  };
  try {
    await apiPost('/api/budgets', body);
    showToast('✅ Đã lưu ngân sách', 'success');
    closeBudgetModal();
    loadBudgetsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteBudget(id) {
  try {
    await apiDelete(`/api/budgets/${id}`);
    showToast('🗑️ Đã xóa ngân sách', 'success');
    loadBudgetsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── GOALS PAGE ───────────────────────────────────────────────────
async function loadGoalsPage() {
  const container = document.getElementById('goals-grid');
  if (!container) return;
  container.innerHTML = '<div class="loading-wrap"><div class="loading-spinner"></div></div>';
  try {
    const goals = await apiGet('/api/goals');
    if (!goals || !goals.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🐖</div><h3>Chưa có mục tiêu tiết kiệm</h3></div>`;
      return;
    }
    container.innerHTML = goals.map(g => {
      const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100);
      return `
        <div class="goal-card" style="border-top:3px solid ${g.color || '#8b5cf6'}">
          <div class="goal-header">
            <div class="goal-icon" style="background:${g.color || '#8b5cf6'}22">${g.icon || '🎯'}</div>
            <div>
              <div class="goal-title">${g.name}</div>
              <div class="goal-deadline">${g.deadline ? `Hạn chót: ${formatDate(g.deadline)}` : 'Không có hạn chót'}</div>
            </div>
          </div>
          <div class="goal-progress-wrap">
            <div class="goal-progress-bar">
              <div class="goal-progress-fill" style="width:${pct}%;background:${g.color || '#8b5cf6'}"></div>
            </div>
            <div class="goal-numbers">
              <span style="color:var(--accent-light)">${formatCurrency(g.current_amount)} (${pct}%)</span>
              <span style="color:var(--text-muted)">/ ${formatCurrency(g.target_amount)}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn btn-success btn-sm" style="flex:1" onclick="openDepositModal(${g.id})">💰 Nạp tiền</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteGoal(${g.id})" style="color:var(--red)">🗑️</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openAddGoalModal() {
  document.getElementById('goal-form').reset();
  document.getElementById('goal-overlay').style.display = 'flex';
}
function closeGoalModal() { document.getElementById('goal-overlay').style.display = 'none'; }

async function handleSubmitGoal(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('goal-name').value,
    target_amount: Number(document.getElementById('goal-target').value),
    current_amount: Number(document.getElementById('goal-current').value) || 0,
    deadline: document.getElementById('goal-deadline').value,
    icon: document.getElementById('goal-icon').value,
  };
  try {
    await apiPost('/api/goals', body);
    showToast('✅ Đã tạo mục tiêu tiết kiệm', 'success');
    closeGoalModal();
    loadGoalsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openDepositModal(goalId) {
  document.getElementById('deposit-goal-id').value = goalId;
  populateWalletSelects();
  document.getElementById('deposit-overlay').style.display = 'flex';
}
function closeDepositModal() { document.getElementById('deposit-overlay').style.display = 'none'; }

async function handleSubmitDeposit(e) {
  e.preventDefault();
  const id = document.getElementById('deposit-goal-id').value;
  const body = {
    wallet_id: Number(document.getElementById('deposit-wallet').value),
    amount: Number(document.getElementById('deposit-amount').value),
  };
  try {
    await apiPost(`/api/goals/${id}/deposit`, body);
    showToast('✅ Đã nạp tiền vào mục tiêu!', 'success');
    closeDepositModal();
    loadGoalsPage();
    loadWallets();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteGoal(id) {
  try {
    await apiDelete(`/api/goals/${id}`);
    showToast('🗑️ Đã xóa mục tiêu tiết kiệm', 'success');
    loadGoalsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── DEBTS PAGE ───────────────────────────────────────────────────
async function loadDebtsPage() {
  const container = document.getElementById('debts-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-wrap"><div class="loading-spinner"></div></div>';
  try {
    const debts = await apiGet('/api/debts');
    if (!debts || !debts.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>Chưa có khoản vay / nợ nào</h3></div>`;
      return;
    }
    container.innerHTML = debts.map(d => `
      <div class="debt-card ${d.is_paid ? 'paid' : ''}">
        <div class="debt-badge ${d.type}">
          ${d.type === 'lend' ? '🤝 Cho vay' : '📥 Đi vay'}
        </div>
        <div class="debt-info">
          <div class="debt-person">${d.person_name}</div>
          <div class="debt-note">${d.note || '—'} ${d.due_date ? `• Hạn trả: ${formatDate(d.due_date)}` : ''}</div>
        </div>
        <div class="debt-amount" style="color:${d.type==='lend'?'var(--green)':'var(--red)'}">${formatCurrency(d.amount)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="toggleDebtPaid(${d.id})">${d.is_paid ? '↩️ Chưa xong' : '✅ Đã xong'}</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteDebt(${d.id})" style="color:var(--red)">🗑️</button>
        </div>
      </div>`).join('');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openAddDebtModal() {
  document.getElementById('debt-form').reset();
  document.getElementById('debt-overlay').style.display = 'flex';
}
function closeDebtModal() { document.getElementById('debt-overlay').style.display = 'none'; }

async function handleSubmitDebt(e) {
  e.preventDefault();
  const body = {
    type: document.getElementById('debt-type').value,
    person_name: document.getElementById('debt-person').value,
    amount: Number(document.getElementById('debt-amount').value),
    due_date: document.getElementById('debt-due').value,
    note: document.getElementById('debt-note').value,
  };
  try {
    await apiPost('/api/debts', body);
    showToast('✅ Đã thêm khoản nợ', 'success');
    closeDebtModal();
    loadDebtsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function toggleDebtPaid(id) {
  try {
    await apiFetch('PATCH', `/api/debts/${id}/toggle-paid`);
    showToast('✅ Đã cập nhật trạng thái khoản nợ', 'success');
    loadDebtsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteDebt(id) {
  try {
    await apiDelete(`/api/debts/${id}`);
    showToast('🗑️ Đã xóa khoản nợ', 'success');
    loadDebtsPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── RECURRING PAGE ───────────────────────────────────────────────
async function loadRecurringPage() {
  const container = document.getElementById('recurring-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-wrap"><div class="loading-spinner"></div></div>';
  try {
    const list = await apiGet('/api/recurring');
    if (!list || !list.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>Chưa có giao dịch lặp lại</h3><p>Nhấn "Thêm lặp lại mới" để cài đặt tự động.</p></div>`;
      return;
    }
    container.innerHTML = list.map(r => `
      <div class="tx-item" id="rec-${r.id}">
        <div class="tx-icon" style="background:${r.category_color}22">${r.category_icon}</div>
        <div class="tx-info">
          <div class="tx-category">${r.category_name} <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg-input);color:var(--accent-light)">Ngày ${r.day_of_month} hàng tháng</span></div>
          <div class="tx-note">${r.note || 'Không có mô tả'} • Ví: ${r.wallet_name || 'Mặc định'}</div>
        </div>
        <div class="tx-amount ${r.type}">${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-success btn-sm" onclick="executeRecurringNow(${r.id})">⚡ Ghi nhận ngay</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteRecurring(${r.id})" style="color:var(--red)">🗑️</button>
        </div>
      </div>`).join('');
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

function openAddRecurringModal() {
  const recWallet = document.getElementById('rec-wallet');
  if (recWallet) recWallet.innerHTML = allWallets.map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
  setRecType('expense');
  document.getElementById('recurring-form').reset();
  document.getElementById('recurring-overlay').style.display = 'flex';
}
function closeRecurringModal() { document.getElementById('recurring-overlay').style.display = 'none'; }

function setRecType(type) {
  currentRecType = type;
  document.getElementById('rec-btn-expense').classList.toggle('active', type === 'expense');
  document.getElementById('rec-btn-income').classList.toggle('active', type === 'income');
  const sel = document.getElementById('rec-category');
  if (sel) {
    const filtered = allCategories.filter(c => c.type === type);
    sel.innerHTML = filtered.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }
}

async function handleSubmitRecurring(e) {
  e.preventDefault();
  const body = {
    type: currentRecType,
    note: document.getElementById('rec-note').value,
    amount: Number(document.getElementById('rec-amount').value),
    wallet_id: Number(document.getElementById('rec-wallet').value),
    category_id: Number(document.getElementById('rec-category').value),
    day_of_month: Number(document.getElementById('rec-day').value) || 1,
  };
  try {
    await apiPost('/api/recurring', body);
    showToast('✅ Đã thêm quy tắc định kỳ', 'success');
    closeRecurringModal();
    loadRecurringPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function executeRecurringNow(id) {
  try {
    const res = await apiPost(`/api/recurring/${id}/execute`);
    showToast(`⚡ ${res.message}`, 'success');
    await loadWallets();
    if (currentPage === 'dashboard') loadDashboard();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

async function deleteRecurring(id) {
  try {
    await apiDelete(`/api/recurring/${id}`);
    showToast('🗑️ Đã xóa quy tắc định kỳ', 'success');
    loadRecurringPage();
  } catch (err) { showToast('❌ ' + err.message, 'error'); }
}

// ── ANALYTICS ────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const data = await apiGet(`/api/dashboard/summary?month=${currentMonth}`);
    renderPieChart(data.by_category.filter(c => c.type === 'expense'));
    renderBarChart(data.monthly_chart);
    renderAnalyticsCatList(data.by_category);
  } catch (err) { showToast('❌ Lỗi tải analytics', 'error'); }
}

function renderPieChart(categories) {
  const ctx = document.getElementById('pie-chart')?.getContext('2d');
  if (!ctx || !categories.length) return;
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(c => c.name),
      datasets: [{ data: categories.map(c => c.total), backgroundColor: categories.map(c => c.color + 'cc'), borderColor: categories.map(c => c.color), borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } } } }
  });
}

function renderBarChart(monthly) {
  const ctx = document.getElementById('bar-chart')?.getContext('2d');
  if (!ctx) return;
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthly.map(d => getMonthLabel(d.month)),
      datasets: [
        { label: 'Thu nhập', data: monthly.map(d => d.income), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#10b981', pointRadius: 4 },
        { label: 'Chi tiêu', data: monthly.map(d => d.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#ef4444', pointRadius: 4 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', callback: v => formatCurrency(v) } } }
    }
  });
}

function renderAnalyticsCatList(categories) {
  const container = document.getElementById('analytics-cat-list');
  if (!container) return;
  const maxVal = Math.max(...categories.map(c => c.total), 1);
  container.innerHTML = categories.map(c => `
    <div class="cat-item">
      <div class="cat-icon-wrap" style="background:${c.color}22">${c.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${c.name}
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px;background:${c.type==='income'?'var(--green-dim)':'var(--red-dim)'};color:${c.type==='income'?'var(--green)':'var(--red)'}">
            ${c.type === 'income' ? '↑ Thu' : '↓ Chi'}
          </span>
        </div>
        <div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.round(c.total/maxVal*100)}%;background:${c.color}"></div></div>
      </div>
      <div class="cat-amount">${formatCurrency(c.total)}</div>
    </div>`).join('') || '<p style="color:var(--text-muted);text-align:center;padding:20px">Chưa có dữ liệu</p>';
}

// ── TRANSACTION MODAL ────────────────────────────────────────────
function openAddModal() {
  document.getElementById('modal-title').textContent = '➕ Thêm giao dịch mới';
  document.getElementById('submit-btn-text').textContent = 'Lưu giao dịch';
  document.getElementById('edit-tx-id').value = '';
  document.getElementById('tx-form').reset();
  document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modal-alert').style.display = 'none';
  setTxType('expense');
  populateWalletSelects();
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function openEditModal(id) {
  try {
    const txs = await apiGet('/api/transactions?limit=200');
    const tx = txs.find(t => t.id === id);
    if (!tx) return;
    document.getElementById('modal-title').textContent = '✏️ Sửa giao dịch';
    document.getElementById('submit-btn-text').textContent = 'Cập nhật';
    document.getElementById('edit-tx-id').value = id;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-note').value = tx.note || '';
    document.getElementById('modal-alert').style.display = 'none';
    setTxType(tx.type);
    document.getElementById('tx-category').value = tx.category_id;
    populateWalletSelects();
    if (tx.wallet_id) document.getElementById('tx-wallet').value = tx.wallet_id;
    document.getElementById('modal-overlay').style.display = 'flex';
  } catch (err) { showToast('❌ Không tải được giao dịch', 'error'); }
}

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function handleOverlayClick(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

function setTxType(type) {
  currentTxType = type;
  document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
  document.getElementById('btn-income').classList.toggle('active', type === 'income');
  updateModalCategories(type);
}

async function handleSubmitTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('edit-tx-id').value;
  const amount = Number(document.getElementById('tx-amount').value);
  const wallet_id = Number(document.getElementById('tx-wallet').value);
  const category_id = Number(document.getElementById('tx-category').value);
  const date = document.getElementById('tx-date').value;
  const note = document.getElementById('tx-note').value;
  const body = { type: currentTxType, wallet_id, amount, category_id, date, note };

  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-btn-text');
  submitBtn.disabled = true;
  submitText.innerHTML = '<div class="spinner"></div>';

  try {
    if (id) {
      await apiPut(`/api/transactions/${id}`, body);
      showToast('✅ Đã cập nhật giao dịch', 'success');
    } else {
      await apiPost('/api/transactions', body);
      showToast('✅ Đã thêm giao dịch', 'success');
    }
    closeModal();
    await loadWallets();
    if (currentPage === 'dashboard') loadDashboard();
    else if (currentPage === 'transactions') loadTransactions();
    else if (currentPage === 'analytics') loadAnalytics();
  } catch (err) {
    const el = document.getElementById('modal-alert');
    el.style.display = 'flex'; el.className = 'alert alert-error'; el.textContent = '⚠️ ' + err.message;
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = id ? 'Cập nhật' : 'Lưu giao dịch';
  }
}

// ── DELETE CONFIRM ────────────────────────────────────────────────
function openDeleteConfirm(id, type = 'transaction') {
  pendingDeleteId = id;
  pendingDeleteType = type;
  document.getElementById('confirm-overlay').style.display = 'flex';
}

function closeConfirm() {
  pendingDeleteId = null;
  document.getElementById('confirm-overlay').style.display = 'none';
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  try {
    if (pendingDeleteType === 'transaction') {
      await apiDelete(`/api/transactions/${pendingDeleteId}`);
      showToast('🗑️ Đã xóa giao dịch', 'success');
      await loadWallets();
      if (currentPage === 'dashboard') loadDashboard();
      else if (currentPage === 'transactions') loadTransactions();
    } else if (pendingDeleteType === 'wallet') {
      await apiDelete(`/api/wallets/${pendingDeleteId}`);
      showToast('🗑️ Đã xóa ví tiền', 'success');
      await loadWallets();
      if (currentPage === 'wallets') loadWalletsPage();
      else if (currentPage === 'dashboard') loadDashboard();
    }
    closeConfirm();
  } catch (err) { showToast('❌ ' + err.message, 'error'); closeConfirm(); }
}

// ── EXPORT CSV ───────────────────────────────────────────────────
function exportCSV() {
  const month = document.getElementById('filter-month')?.value || currentMonth;
  fetch(API + `/api/transactions?month=${month}&limit=1000`, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(txs => {
      let csv = 'ID,Ngay,Loai,Danh Muc,Vi Tien,So Tien,Ghi Chu\n';
      txs.forEach(t => {
        csv += `${t.id},"${t.date}","${t.type}","${t.category_name}","${t.wallet_name || ''}",${t.amount},"${(t.note||'').replace(/"/g, '""')}"\n`;
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spendwise_transactions_${month}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('✅ Đã xuất file CSV thành công!', 'success');
    })
    .catch(() => showToast('❌ Xuất CSV thất bại', 'error'));
}

// ── CHARTS CLEANUP ───────────────────────────────────────────────
function destroyCharts() {
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}

// ── TOAST ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'slideUp 0.3s ease reverse'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── API HELPERS ──────────────────────────────────────────────────
async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { handleLogout(); throw new Error('Phiên đăng nhập hết hạn.'); }
    throw new Error(data.error || `Lỗi HTTP ${res.status}`);
  }
  return data;
}
const apiGet = url => apiFetch('GET', url);
const apiPost = (url, body) => apiFetch('POST', url, body);
const apiPut = (url, body) => apiFetch('PUT', url, body);
const apiDelete = url => apiFetch('DELETE', url);

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); closeConfirm(); closeWalletModal();
    closeTransferModal(); closeBudgetModal(); closeGoalModal();
    closeDepositModal(); closeDebtModal(); closeRecurringModal();
  }
  if (e.ctrlKey && e.key === 'n' && token) { e.preventDefault(); openAddModal(); }
});
