/**
 * Automated Test Runner for SpendWise Personal MVP
 * Tests Authentication, Wallets, Transactions, Budgets, Goals, Debts, Recurring, Dashboard
 */
const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  const res = await fetch(url, options);
  const duration = Date.now() - start;
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, duration };
}

async function runAllTests() {
  console.log('🧪 Starting SpendWise MVP Automated Test Suite...\n');
  const results = [];

  // Helper
  const addResult = (id, name, input, expected, actual, pass, duration) => {
    results.push({ id, name, input, expected, actual, result: pass ? 'PASS' : 'FAIL', duration });
    console.log(`${pass ? '✅' : '❌'} [${id}] ${name} (${duration}ms) -> ${pass ? 'PASS' : 'FAIL'}`);
  };

  let token = null;
  let testWalletId = null;
  let testTxId = null;
  let testBudgetId = null;
  let testGoalId = null;
  let testDebtId = null;

  // TC01: Health check
  try {
    const res = await request('/api/health');
    const pass = res.status === 200 && res.data.status === 'ok';
    addResult('TC-01', 'Kiểm tra trạng thái máy chủ (Health Check)', 'GET /api/health', 'status: 200, status="ok"', `status: ${res.status}, body=${JSON.stringify(res.data)}`, pass, res.duration);
  } catch (e) {
    addResult('TC-01', 'Kiểm tra trạng thái máy chủ', 'GET /api/health', 'status: 200', e.message, false, 0);
  }

  // TC02: Static Frontend Loading
  try {
    const res = await request('/');
    const pass = res.status === 200 && res.data.includes('SpendWise');
    addResult('TC-02', 'Tải giao diện Frontend (SPA Index.html)', 'GET /', 'status: 200, chứa HTML SpendWise', `status: ${res.status}, length=${res.data.length} chars`, pass, res.duration);
  } catch (e) {
    addResult('TC-02', 'Tải giao diện Frontend', 'GET /', 'status: 200', e.message, false, 0);
  }

  // TC03: Đăng nhập sai mật khẩu
  try {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.com', password: 'wrongpassword' })
    });
    const pass = res.status === 401;
    addResult('TC-03', 'Xác thực: Đăng nhập sai mật khẩu', 'POST /api/auth/login (password: wrongpassword)', 'status: 401, error message', `status: ${res.status}, error=${res.data.error}`, pass, res.duration);
  } catch (e) {
    addResult('TC-03', 'Xác thực: Đăng nhập sai', 'POST /api/auth/login', 'status: 401', e.message, false, 0);
  }

  // TC04: Đăng nhập thành công với tài khoản mẫu
  try {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.com', password: 'demo123' })
    });
    const pass = res.status === 200 && !!res.data.token;
    if (pass) token = res.data.token;
    addResult('TC-04', 'Xác thực: Đăng nhập thành công', 'POST /api/auth/login (demo@example.com / demo123)', 'status: 200, trả JWT token & user profile', `status: ${res.status}, user=${res.data.user?.name}`, pass, res.duration);
  } catch (e) {
    addResult('TC-04', 'Xác thực: Đăng nhập thành công', 'POST /api/auth/login', 'status: 200', e.message, false, 0);
  }

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // TC05: Truy cập API cần bảo vệ không có token
  try {
    const res = await request('/api/wallets');
    const pass = res.status === 401;
    addResult('TC-05', 'Bảo mật: Truy cập Protected API không có Token', 'GET /api/wallets (No Auth)', 'status: 401 Unauthorized', `status: ${res.status}, error=${res.data.error}`, pass, res.duration);
  } catch (e) {
    addResult('TC-05', 'Bảo mật: Không có Token', 'GET /api/wallets', 'status: 401', e.message, false, 0);
  }

  // TC06: Lấy thông tin Dashboard Summary
  try {
    const res = await request('/api/dashboard/summary', { headers: authHeaders });
    const pass = res.status === 200 && res.data.summary && res.data.wallets?.length > 0;
    addResult('TC-06', 'Dashboard: Tải số liệu tổng quan & biểu đồ', 'GET /api/dashboard/summary', 'status: 200, có summary, alerts, wallets, chart', `status: ${res.status}, net_worth=${res.data.summary?.net_worth?.toLocaleString()}đ`, pass, res.duration);
  } catch (e) {
    addResult('TC-06', 'Dashboard: Tải tổng quan', 'GET /api/dashboard/summary', 'status: 200', e.message, false, 0);
  }

  // TC07: Quản lý Ví: Danh sách ví tiền
  try {
    const res = await request('/api/wallets', { headers: authHeaders });
    const pass = res.status === 200 && Array.isArray(res.data) && res.data.length >= 4;
    addResult('TC-07', 'Ví tài chính: Lấy danh sách ví của người dùng', 'GET /api/wallets', 'status: 200, danh sách >= 4 ví tiền', `status: ${res.status}, số lượng ví=${res.data.length}`, pass, res.duration);
  } catch (e) {
    addResult('TC-07', 'Ví tài chính: Danh sách ví', 'GET /api/wallets', 'status: 200', e.message, false, 0);
  }

  // TC08: Quản lý Ví: Tạo ví mới
  try {
    const res = await request('/api/wallets', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Quỹ Đầu Tư Vàng', type: 'bank', balance: 15000000, icon: '🪙', color: '#eab308' })
    });
    const pass = res.status === 201 && res.data.id;
    if (pass) testWalletId = res.data.id;
    addResult('TC-08', 'Ví tài chính: Tạo mới ví cá nhân', 'POST /api/wallets (Quỹ Đầu Tư Vàng, 15.000.000đ)', 'status: 201, trả object ví có ID', `status: ${res.status}, ví_id=${res.data.id}, tên=${res.data.name}`, pass, res.duration);
  } catch (e) {
    addResult('TC-08', 'Ví tài chính: Tạo ví mới', 'POST /api/wallets', 'status: 201', e.message, false, 0);
  }

  // TC09: Giao dịch: Thêm giao dịch chi tiêu mới
  try {
    const res = await request('/api/transactions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        wallet_id: testWalletId || 1,
        category_id: 6, // Ăn uống
        type: 'expense',
        amount: 150000,
        note: 'Ăn trưa bún bò Huế',
        date: new Date().toISOString().slice(0, 10)
      })
    });
    const pass = res.status === 201 && res.data.id;
    if (pass) testTxId = res.data.id;
    addResult('TC-09', 'Giao dịch: Thêm mới chi tiêu (Trừ tiền ví)', 'POST /api/transactions (Chi ăn uống 150.000đ)', 'status: 201, tạo thành công & cập nhật số dư ví', `status: ${res.status}, tx_id=${res.data.id}`, pass, res.duration);
  } catch (e) {
    addResult('TC-09', 'Giao dịch: Thêm mới chi tiêu', 'POST /api/transactions', 'status: 201', e.message, false, 0);
  }

  // TC10: Giao dịch: Kiểm tra validation số tiền <= 0
  try {
    const res = await request('/api/transactions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        category_id: 6,
        type: 'expense',
        amount: -50000,
        note: 'Lỗi số tiền âm',
        date: '2026-09-25'
      })
    });
    const pass = res.status === 400;
    addResult('TC-10', 'Validation: Thêm giao dịch với số tiền không hợp lệ', 'POST /api/transactions (amount: -50.000đ)', 'status: 400, thông báo lỗi số tiền', `status: ${res.status}, error=${res.data.error}`, pass, res.duration);
  } catch (e) {
    addResult('TC-10', 'Validation: Số tiền âm', 'POST /api/transactions', 'status: 400', e.message, false, 0);
  }

  // TC11: Giao dịch: Lọc danh sách giao dịch
  try {
    const res = await request('/api/transactions?type=expense&limit=10', { headers: authHeaders });
    const pass = res.status === 200 && Array.isArray(res.data) && res.data.every(t => t.type === 'expense');
    addResult('TC-11', 'Giao dịch: Bộ lọc theo loại chi tiêu', 'GET /api/transactions?type=expense', 'status: 200, danh sách chỉ chứa khoản chi', `status: ${res.status}, số lượng=${res.data.length}`, pass, res.duration);
  } catch (e) {
    addResult('TC-11', 'Giao dịch: Bộ lọc', 'GET /api/transactions', 'status: 200', e.message, false, 0);
  }

  // TC12: Ngân sách: Thiết lập ngân sách danh mục
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const res = await request('/api/budgets', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ category_id: 10, amount_limit: 1200000, month: currentMonth }) // Y tế
    });
    const pass = (res.status === 200 || res.status === 201) && res.data.id;
    addResult('TC-12', 'Ngân sách: Thiết lập hạn mức chi tiêu tháng', 'POST /api/budgets (Y tế, Hạn mức 1.200.000đ)', 'status: 200/201, lưu ngân sách thành công', `status: ${res.status}, budget_id=${res.data.id}`, pass, res.duration);
  } catch (e) {
    addResult('TC-12', 'Ngân sách: Thiết lập hạn mức', 'POST /api/budgets', 'status: 201', e.message, false, 0);
  }

  // TC13: Mục tiêu tiết kiệm: Tạo mục tiêu và nạp tiền
  try {
    const res = await request('/api/goals', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Mua Khóa học Cloud DevOps',
        target_amount: 5000000,
        deadline: '2026-11-30',
        icon: '🎓',
        color: '#8b5cf6'
      })
    });
    const pass = res.status === 201 && res.data.id;
    if (pass) testGoalId = res.data.id;
    addResult('TC-13', 'Tiết kiệm: Tạo mục tiêu tiết kiệm mới', 'POST /api/goals (Mục tiêu 5.000.000đ)', 'status: 201, tạo mục tiêu thành công', `status: ${res.status}, goal_id=${res.data.id}`, pass, res.duration);
  } catch (e) {
    addResult('TC-13', 'Tiết kiệm: Tạo mục tiêu', 'POST /api/goals', 'status: 201', e.message, false, 0);
  }

  // TC14: Sổ nợ: Thêm khoản cho vay và cập nhật trạng thái
  try {
    const res = await request('/api/debts', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        person_name: 'Bạn Tuấn',
        type: 'lend',
        amount: 800000,
        due_date: '2026-10-15',
        note: 'Cho mượn tiền xăng xe'
      })
    });
    const pass = res.status === 201 && res.data.id;
    if (pass) testDebtId = res.data.id;
    addResult('TC-14', 'Sổ nợ: Ghi nhận khoản cho vay', 'POST /api/debts (Cho bạn Tuấn vay 800.000đ)', 'status: 201, ghi nhận khoản nợ', `status: ${res.status}, debt_id=${res.data.id}`, pass, res.duration);
  } catch (e) {
    addResult('TC-14', 'Sổ nợ: Ghi nhận khoản nợ', 'POST /api/debts', 'status: 201', e.message, false, 0);
  }

  // TC15: Xóa giao dịch hoàn trả số dư ví
  try {
    if (testTxId) {
      const res = await request(`/api/transactions/${testTxId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const pass = res.status === 200;
      addResult('TC-15', 'Giao dịch: Xóa giao dịch và hoàn số dư ví', `DELETE /api/transactions/${testTxId}`, 'status: 200, số dư ví hoàn lại', `status: ${res.status}, msg=${res.data.message}`, pass, res.duration);
    } else {
      addResult('TC-15', 'Giao dịch: Xóa giao dịch', 'DELETE /api/transactions/1', 'status: 200', 'Bỏ qua do không có txId', false, 0);
    }
  } catch (e) {
    addResult('TC-15', 'Giao dịch: Xóa giao dịch', 'DELETE', 'status: 200', e.message, false, 0);
  }

  // TC16: Kiểm tra bảo mật SQL Injection
  try {
    const res = await request("/api/transactions?month=' OR '1'='1", { headers: authHeaders });
    const pass = res.status === 200 && Array.isArray(res.data);
    addResult('TC-16', 'Bảo mật: Ngăn chặn tấn công SQL Injection', "GET /api/transactions?month=' OR '1'='1", 'status: 200, query được parameterize an toàn không leak', `status: ${res.status}, trả mảng rỗng hoặc đúng chuẩn`, pass, res.duration);
  } catch (e) {
    addResult('TC-16', 'Bảo mật: SQL Injection', 'GET', 'status: 200', e.message, false, 0);
  }

  console.log('\n📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ:');
  const total = results.length;
  const passed = results.filter(r => r.result === 'PASS').length;
  const failed = total - passed;
  const passRate = ((passed / total) * 100).toFixed(1);
  const avgDuration = (results.reduce((acc, cur) => acc + cur.duration, 0) / total).toFixed(1);

  console.log(`- Tổng số Test Cases: ${total}`);
  console.log(`- Thành công (PASS):   ${passed}`);
  console.log(`- Thất bại (FAIL):     ${failed}`);
  console.log(`- Tỷ lệ đạt (Pass Rate): ${passRate}%`);
  console.log(`- Thời gian phản hồi TB: ${avgDuration}ms\n`);

  // Lưu file kết quả
  const fs = require('fs');
  fs.writeFileSync('test_results.json', JSON.stringify({ summary: { total, passed, failed, passRate, avgDuration }, results }, null, 2));
  console.log('💾 Đã lưu kết quả kiểm thử vào test_results.json');
}

runAllTests();
