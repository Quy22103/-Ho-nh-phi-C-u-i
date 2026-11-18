# HỒ SƠ SỐ HOÀNH PHI – CÂU ĐỐI HÀ NỘI

Hệ thống hồ sơ số thu thập, lưu trữ, số hóa, bảo tồn và tra cứu hoành phi, câu đối và tư liệu Hán Nôm liên quan tại đình, chùa, đền, miếu, nhà thờ họ và từ đường trên toàn địa bàn thành phố Hà Nội.

Sản phẩm thực tập của Trương Văn Quý, mã sinh viên PH68121, Nhóm 2, Chương trình Thực tập sinh Đợt 15 FPT Polytechnic và IMTA TECH.

---

## 1. Nguyên tắc lưu trữ và bảo mật cốt lõi

- **Không dữ liệu giả**: Tệp `data/tulieu.json` khởi tạo với `"records": []` và `"sources": []`. Hệ thống vận hành bình thường ngay cả khi chưa có dữ liệu.
- **Kiểm chứng độc lập**: Hồ sơ tổng thể, `phien_am` và `dich_nghia` đều có `trang_thai` kiểm chứng riêng (`da_kiem_chung`, `chua_kiem_chung`, `chua_doc_duoc`).
- **Kiểm tra quyền công bố ảnh tại backend**: Ảnh chỉ được phục vụ qua `/api/images/:identifier/:imageId` khi hồ sơ có đủ `nguoi_cho_phep_cong_bo`, `pham_vi_duoc_phep` hợp lệ và từng ảnh có `permission === "duoc_phep_cong_bo"`. Ảnh thu nhỏ mặc định được tải trước; ảnh gốc độ phân giải cao nằm riêng trong `storage/images/originals/`.
- **Gemini AI chỉ mang tính tham khảo**: `GEMINI_API_KEY` chỉ nằm ở biến môi trường phía backend. Gemini Hỏi đáp chỉ trả lời từ các bản ghi tìm thấy trong `data/tulieu.json`; chức năng đề xuất phiên âm từ ảnh luôn gắn nhãn `ĐỀ XUẤT AI – CHƯA KIỂM CHỨNG` và không tự ghi đè dữ liệu gốc.

---

## 2. Cấu trúc thư mục chính

- `server.ts` & `server/`: Máy chủ Node.js + Express phục vụ REST API, bảo vệ quyền công bố ảnh, xuất JSON/CSV và kết nối `@google/genai`.
- `src/`: Giao diện React + TypeScript + Vite + Tailwind CSS gồm 6 màn hình (`Home`, `DanhSach`, `ChiTiet`, `HoiDap`, `NguonTuLieu`, `GioiThieu`).
- `data/tulieu.json`: Tệp dữ liệu hồ sơ số theo chuẩn 15 trường Dublin Core và các trường di sản mở rộng.
- `data/submissions.json`: Hàng chờ ghi nhận phiếu đóng góp tư liệu từ người dân / Ban quản lý (không tự ghi vào `tulieu.json`).
- `storage/images/originals/`: Thư mục chứa ảnh gốc độ phân giải cao.
- `storage/images/thumbnails/`: Thư mục chứa ảnh thu nhỏ mặc định hiển thị trên web.

---

## 3. Hướng dẫn cài đặt và chạy trên máy cá nhân

### Yêu cầu môi trường
- Node.js phiên bản `>= 20` (khuyến nghị Node 22 LTS).
- npm `>= 10`.

### Các bước cài đặt
1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```
2. Sao chép tệp mẫu môi trường thành `.env`:
   ```bash
   cp .env.example .env
   ```
3. Chạy chế độ phát triển (cả backend API và Vite frontend trên cổng 3000):
   ```bash
   npm run dev
   ```
4. Truy cập trình duyệt tại `http://localhost:3000`.

### Biên dịch và chạy bản production
```bash
npm run build
NODE_ENV=production npm start
```

---

## 4. Hướng dẫn cấu hình Gemini API Key

1. Tạo API Key tại Google AI Studio.
2. Mở tệp `.env` ở thư mục gốc và điền khóa vào biến `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY="AIza..."
   ```
3. Khởi động lại máy chủ (`npm run dev`).
4. **Lưu ý bảo mật**: Không bao giờ đưa tệp `.env` hoặc API Key thật vào mã nguồn frontend hoặc đẩy lên GitHub. Nếu chưa cấu hình `GEMINI_API_KEY`, các chức năng tra cứu, xem chi tiết, nguồn tư liệu và xuất JSON/CSV vẫn hoạt động bình thường.

---

## 5. Hướng dẫn nạp dữ liệu thật vào `data/tulieu.json`

Mỗi hồ sơ thêm vào mảng `"records"` trong `data/tulieu.json` cần tuân thủ cấu trúc 15 trường Dublin Core và các trường mở rộng:

- Giữ nguyên sự phân tách giữa địa danh hiện hành (`don_vi_hanh_chinh_hien_nay`, `phuong_xa_hien_nay`) và địa danh lịch sử (`don_vi_hanh_chinh_lich_su`, `phuong_xa_lich_su`). Để trống các trường chưa xác định.
- Mặc định `muc_kiem_chung`, `phien_am.trang_thai`, `dich_nghia.trang_thai` là `"chua_kiem_chung"` cho đến khi người có chuyên môn xác nhận.
- Chỉ đặt `cong_khai_nguoi_cung_cap: true` khi người cung cấp đồng ý công khai tên.
- Nếu có phần nội dung nội bộ không công bố, ghi vào `phan_khong_cong_bo` (backend sẽ tự động lọc bỏ khi trả dữ liệu công khai và khi xuất JSON/CSV).

---

## 6. Hướng dẫn thêm ảnh toàn trang và ảnh cận cảnh

1. Chuẩn bị hai phiên bản ảnh cho mỗi góc chụp:
   - **Ảnh thu nhỏ** (chiều rộng khoảng 800px–1200px, dung lượng nhẹ): đặt vào `storage/images/thumbnails/`.
   - **Ảnh gốc độ phân giải cao**: đặt vào `storage/images/originals/`.
2. Khai báo trong mảng `images` của bản ghi tương ứng trong `data/tulieu.json`:
   ```json
   {
     "image_id": "IMG-001-TOAN-TRANG",
     "file": "originals/ten-anh-goc.jpg",
     "thumbnail": "thumbnails/ten-anh-nho.jpg",
     "image_type": "toan_trang",
     "caption": "Ảnh chụp toàn trang bức hoành phi tại gian chính",
     "source": "Ban quản lý di tích cung cấp",
     "permission": "duoc_phep_cong_bo"
   }
   ```
3. Các giá trị `image_type` hỗ trợ: `toan_trang`, `can_canh`, `can_canh_trai`, `can_canh_phai`, `can_canh_chu`, `ban_dap`, `ban_sao`, `khac`.
4. **Điều kiện bắt buộc để ảnh hiển thị**: Bản ghi phải có đủ `nguoi_cho_phep_cong_bo` và `pham_vi_duoc_phep`, đồng thời ảnh có `permission: "duoc_phep_cong_bo"`. Nếu thiếu một trong các điều kiện này, hệ thống sẽ chặn ở backend và hiển thị thông báo chờ xác nhận quyền công bố.
