# HỒ SƠ SỐ HOÀNH PHI – CÂU ĐỐI HÀ NỘI

Hệ thống hồ sơ số thu thập, lưu trữ, số hóa, bảo tồn và tra cứu hoành phi, câu đối và tư liệu Hán Nôm liên quan tại đình, chùa, đền, miếu, nhà thờ họ và từ đường trên toàn địa bàn thành phố Hà Nội.

Sản phẩm thực tập của Trương Văn Quý, mã sinh viên PH68121, Nhóm 2, Chương trình Thực tập sinh Đợt 15 FPT Polytechnic và IMTA TECH.

---

## 1. Nguyên tắc lưu trữ, phân quyền và bảo mật

- **Không dữ liệu giả**: Tệp `data/tulieu.json` khởi tạo với `"records": []` và `"sources": []`.
- **3 vai trò phân quyền (RBAC phía backend)**:
  - **Khách truy cập (`PUBLIC`)**: Xem hồ sơ `DA_CONG_KHAI`, tra cứu, hỏi đáp Gemini, gửi tư liệu mới hoặc đề nghị bổ sung/chỉnh sửa qua hàng chờ và tra cứu tiến độ bằng mã tiếp nhận. Không thể tự xác nhận, công khai hồ sơ hoặc truy cập trang quản trị.
  - **Người kiểm duyệt (`REVIEWER`)**: Đăng nhập bằng tài khoản được ADMIN cấp, kiểm tra tư liệu chờ xác nhận, chỉnh sửa hồ sơ, đánh dấu kiểm chứng từng phần (địa điểm, nguồn, Hán/Nôm, phiên âm, dịch nghĩa, niên đại), yêu cầu bổ sung hoặc từ chối (kèm lý do). Không thể tạo ADMIN, quản lý tài khoản hoặc xóa lịch sử thao tác.
  - **Quản trị viên (`ADMIN`)**: Toàn quyền quản lý tài khoản (`Tạo`, `Sửa`, `Khóa`, `Mở khóa`, phân quyền công khai), quản lý hồ sơ chính thức, nguồn tư liệu, quyền công bố ảnh và xem lịch sử thao tác bất biến.
- **Mật khẩu & Phiên đăng nhập**: Băm mật khẩu bằng BCrypt (cost 12), không lưu mật khẩu văn bản thuần, không có mật khẩu mặc định trong mã nguồn, cookie phiên `HttpOnly` ký HMAC-SHA256 có thời hạn và giới hạn số lần đăng nhập sai.
- **Ảnh chờ duyệt & quyền công bố**: Ảnh người dân gửi lưu riêng trong `storage/pending_images/` (chỉ tài khoản `ADMIN`/`REVIEWER` mới xem được) và chỉ được công khai sau khi xác nhận đủ người cho phép công bố và phạm vi sử dụng.

---

## 2. Cấu trúc thư mục chính

- `server.ts` & `server/`: Máy chủ Node.js + Express (API công khai, xác thực BCrypt/HMAC, RBAC middleware, quản lý hàng chờ duyệt, lịch sử bất biến, bảo vệ ảnh, xuất JSON/CSV và Gemini AI).
- `scripts/create-admin.ts`: Công cụ dòng lệnh khởi tạo tài khoản `ADMIN` ban đầu an toàn.
- `src/`: Giao diện React + TypeScript + Vite + Tailwind CSS gồm 6 màn hình công khai và khu vực đăng nhập (`/admin/login`), quản trị (`/admin`), kiểm duyệt (`/admin/kiem-duyet`).
- `data/tulieu.json`: Dữ liệu chính thức theo chuẩn 15 trường Dublin Core và các trường di sản mở rộng.
- `data/submissions.json`: Hàng chờ tiếp nhận đóng góp từ người dân/Ban quản lý.
- `data/users.json` & `data/audit_log.json`: Tài khoản đã băm BCrypt và lịch sử thao tác bất biến.
- `storage/images/` (`originals/`, `thumbnails/`) & `storage/pending_images/`: Thư mục ảnh tách biệt khỏi đường dẫn công khai.

---

## 3. Hướng dẫn cài đặt và chạy trên máy cá nhân

1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```
2. Tạo tệp `.env` từ mẫu:
   ```bash
   cp .env.example .env
   ```
3. Khởi tạo tài khoản `ADMIN` ban đầu (chọn một trong hai cách):
   - **Cách 1 (CLI)**: Chạy lệnh `npm run create-admin` và nhập thông tin trực tiếp trên terminal.
   - **Cách 2 (Giao diện lần đầu)**: Chạy ứng dụng và mở `/admin/login` khi chưa có tài khoản nào để khởi tạo tài khoản `ADMIN` đầu tiên (tự khóa ngay sau khi tạo).
4. Chạy ứng dụng trên cổng 3000:
   ```bash
   npm run dev
   ```
5. Biên dịch và chạy bản production:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

## 4. Hướng dẫn cấu hình Gemini API Key & Nạp dữ liệu

- **Cấu hình Gemini API Key**: Thêm `GEMINI_API_KEY="AIza..."` vào `.env` phía backend (không đưa vào frontend hoặc GitHub).
- **Nạp dữ liệu vào `data/tulieu.json`**: Mỗi bản ghi tuân thủ 15 trường Dublin Core, phân tách địa danh hiện hành và địa danh lịch sử, trạng thái kiểm chứng độc lập và thông tin quyền công bố ảnh.
- **Thêm ảnh**: Đặt ảnh thu nhỏ vào `storage/images/thumbnails/`, ảnh gốc vào `storage/images/originals/`, khai báo trong mảng `images` và chỉ đặt `permission: "duoc_phep_cong_bo"` khi đã có đủ `nguoi_cho_phep_cong_bo` và `pham_vi_duoc_phep`.
