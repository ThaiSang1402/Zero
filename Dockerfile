# Sử dụng Node.js Alpine làm base image gọn nhẹ
FROM node:18-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json để install dependencies
COPY package*.json ./

# Cài đặt sản phẩm
RUN npm ci --only=production

# Copy toàn bộ mã nguồn ứng dụng
COPY . .

# Expose cổng ứng dụng
EXPOSE 3000

# Biến môi trường mặc định
ENV PORT=3000
ENV NODE_ENV=production

# Tự động tạo seed dữ liệu mẫu nếu chưa có CSDL và khởi chạy server
CMD ["sh", "-c", "node seed.js && node server/index.js"]
