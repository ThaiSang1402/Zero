# 💎 SpendWise Personal — Ứng dụng Quản lý Chi Tiêu Cá Nhân trên Cloud

> Ứng dụng Quản lý Tài chính & Chi tiêu Cá nhân Thông minh, xây dựng với **Node.js + Express + SQLite (sql.js) + Vanilla JS (SPA)**, hỗ trợ đóng gói Docker sẵn sàng triển khai lên các nền tảng Cloud (Render, Railway, Fly.io, AWS).

---

## 📸 Demo & Dữ liệu Mẫu

Tài khoản mẫu có sẵn sau khi chạy seed:

| Trường | Giá trị |
|---|---|
| **Email** | `demo@example.com` |
| **Password** | `demo123` |

---

## 🚀 Tính năng Cốt lõi

| Tính năng | Mô tả chi tiết |
|---|---|
| 🔐 **Authentication** | Đăng ký / Đăng nhập an toàn với JWT + bcrypt |
| 👛 **Quản lý Ví & Tài khoản** | Quản lý nhiều ví (Tiền mặt, Ngân hàng, Ví Momo, Thẻ tín dụng), hỗ trợ chuyển tiền giữa các ví |
| 💳 **Quản lý Giao dịch** | Thêm / Sửa / Xóa thu nhập & chi tiêu gắn liền với từng ví cụ thể |
| 🎯 **Ngân sách Chi tiêu** | Đặt hạn mức chi tiêu theo tháng cho từng danh mục & hiển thị thanh tiến trình cảnh báo % |
| 🐖 **Mục tiêu Tiết kiệm** | Theo dõi tiến độ tích lũy cho các mục tiêu lớn (Mua sắm, Du lịch, Quỹ khẩn cấp) |
| 📝 **Sổ Vay & Nợ** | Theo dõi khoản tiền cho người khác vay hoặc đi vay, đánh dấu đã hoàn tất |
| 📈 **Phân tích & Biểu đồ** | Biểu đồ tròn tỷ lệ chi tiêu, biểu đồ đường xu hướng 6 tháng (Chart.js) |
| ⬇️ **Xuất dữ liệu CSV** | Xuất báo cáo lịch sử giao dịch cá nhân ra file CSV/Excel |
| 🐳 **Cloud-Ready / Docker** | Đóng gói sẵn Dockerfile giúp deploy lên Cloud trong 1 click |

---

## 🛠️ Tech Stack

```
├── Backend:   Node.js + Express.js
├── Database:  SQLite (sql.js - WebAssembly in-memory with file persistence)
├── Auth:      JWT + bcryptjs
├── Frontend:  HTML5 + Vanilla CSS (Dark Theme) + Vanilla JS (SPA)
├── Charts:    Chart.js 4.x
└── Cloud:     Dockerfile + .env configuration
```

---

## ⚡ Cài đặt & Chạy ứng dụng

### Yêu cầu
- Node.js 16+
- npm

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Tạo Dữ liệu Mẫu (Seed Data)
```bash
npm run seed
```

### 3. Khởi động Server
```bash
npm start
```

### 4. Truy cập trên Trình duyệt
```
http://localhost:3000
```

---

## 🐳 Triển khai với Docker / Cloud

```bash
# Build Docker image
docker build -t spendwise-personal .

# Run container
docker run -p 3000:3000 spendwise-personal
```

---

## 📁 Cấu trúc thư mục

```
SpendWise/
├── server/
│   ├── index.js              # Express entry point
│   ├── db.js                 # SQLite Connection & Schemas
│   ├── middleware/
│   │   └── auth.js           # JWT Middleware
│   └── routes/
│       ├── auth.js           # Auth APIs (/api/auth/*)
│       ├── transactions.js   # Transaction APIs (/api/transactions/*)
│       ├── dashboard.js      # Dashboard APIs (/api/dashboard/*)
│       ├── wallets.js        # Wallet APIs (/api/wallets/*)
│       ├── budgets.js        # Budget APIs (/api/budgets/*)
│       ├── goals.js          # Savings Goal APIs (/api/goals/*)
│       └── debts.js          # Debt APIs (/api/debts/*)
├── public/
│   ├── index.html            # SPA Main View
│   ├── css/style.css         # Modern Dark Theme UI
│   └── js/app.js             # SPA Client Logic & Charts
├── seed.js                   # Seed mock data script
├── Dockerfile                # Cloud Deployment Container
├── .env.example              # Environment variables template
├── package.json
└── README.md
```
