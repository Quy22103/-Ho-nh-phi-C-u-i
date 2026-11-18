export type VerificationLevel =
  | 'da_kiem_chung'
  | 'chua_kiem_chung'
  | 'chua_doc_duoc';

export type ProcessingStatus =
  | 'PENDING'
  | 'CHO_XAC_NHAN'
  | 'DANG_KIEM_TRA'
  | 'CAN_BO_SUNG'
  | 'DA_XAC_NHAN'
  | 'TU_CHOI'
  | 'CHO_CONG_KHAI'
  | 'DA_CONG_KHAI';

export type UserRole = 'PUBLIC' | 'REVIEWER' | 'ADMIN';

export type ImageType =
  | 'toan_trang'
  | 'can_canh'
  | 'can_canh_trai'
  | 'can_canh_phai'
  | 'can_canh_chu'
  | 'ban_dap'
  | 'ban_sao'
  | 'khac';

export type ImagePermission =
  | 'duoc_phep_cong_bo'
  | 'cho_xac_nhan'
  | 'khong_cong_bo';

export interface GranularVerification {
  dia_diem: VerificationLevel;
  nguon_tu_lieu: VerificationLevel;
  chu_han_nom: VerificationLevel;
  phien_am: VerificationLevel;
  dich_nghia: VerificationLevel;
  nien_dai: VerificationLevel;
}

export interface CoverageInfo {
  thanh_pho: string;
  don_vi_hanh_chinh_hien_nay: string;
  don_vi_hanh_chinh_lich_su: string;
  phuong_xa_hien_nay: string;
  phuong_xa_lich_su: string;
  thon_lang: string;
  thoi_gian: string;
}

export interface TextFieldWithStatus {
  noi_dung: string;
  trang_thai: VerificationLevel;
}

export interface ArchiveImageRaw {
  image_id: string;
  file: string;
  thumbnail: string;
  image_type: ImageType;
  caption: string;
  source: string;
  permission: ImagePermission | string;
}

export interface PublicImage {
  image_id: string;
  image_type: ImageType;
  caption: string;
  source: string;
  thumbnail_url: string;
  original_url: string;
}

export interface EditHistoryItem {
  ngay: string;
  noi_dung: string;
  nguoi_thuc_hien?: string;
}

export interface ArchiveRecordRaw {
  // 15 trường Dublin Core
  identifier: string;
  title: string;
  ten_goi_khac?: string;
  creator: string;
  subject: string[];
  description: string;
  publisher: string;
  contributor: string[];
  date: string;
  type: string;
  format: string;
  source: string[];
  language: string;
  relation: string[];
  coverage: CoverageInfo;
  rights: string;

  // Các trường bổ sung bắt buộc (16-30)
  noi_luu_giu_hien_nay: string;
  noi_luu_giu_tai_thoi_diem_tu_lieu: string;
  loai_ban_dang_hien_thi: string;
  tinh_trang_ban_goc: string;
  so_dang_ky: string;
  nguoi_cho_phep_cong_bo: string;
  pham_vi_duoc_phep: string;
  phan_khong_cong_bo: string;
  muc_kiem_chung: VerificationLevel;
  images: ArchiveImageRaw[];
  chu_han_nom: string;
  phien_am: TextFieldWithStatus;
  dich_nghia: TextFieldWithStatus;
  ghi_chu: string;
  ngay_cap_nhat: string;

  // Trường chi tiết hỗ trợ tra cứu, phân quyền và kiểm chứng từng phần
  trang_thai_xu_ly?: ProcessingStatus;
  kiem_chung_chi_tiet?: GranularVerification;
  loai_dia_diem_luu_giu?: string;
  ten_di_tich?: string;
  dong_ho_lien_quan?: string;
  gia_dinh_lien_quan?: string;
  nha_tho_ho?: string;
  giai_thich_noi_dung?: TextFieldWithStatus;
  ghi_chu_nghien_cuu?: TextFieldWithStatus;
  ngay_tiep_nhan?: string;
  cong_khai_nguoi_cung_cap?: boolean;
  lich_su_chinh_sua?: EditHistoryItem[];
}

export interface PublicRecord {
  identifier: string;
  title: string;
  ten_goi_khac?: string;
  creator: string;
  subject: string[];
  description: string;
  publisher: string;
  contributor: string[];
  date: string;
  type: string;
  format: string;
  source: string[];
  language: string;
  relation: string[];
  coverage: CoverageInfo;
  rights: string;
  noi_luu_giu_hien_nay: string;
  noi_luu_giu_tai_thoi_diem_tu_lieu: string;
  loai_ban_dang_hien_thi: string;
  tinh_trang_ban_goc: string;
  so_dang_ky: string;
  nguoi_cho_phep_cong_bo: string;
  pham_vi_duoc_phep: string;
  co_phan_khong_cong_bo: boolean;
  muc_kiem_chung: VerificationLevel;
  kiem_chung_chi_tiet?: GranularVerification;
  trang_thai_xu_ly?: ProcessingStatus;
  chu_han_nom: string;
  phien_am: TextFieldWithStatus;
  dich_nghia: TextFieldWithStatus;
  ghi_chu: string;
  ngay_cap_nhat: string;
  loai_dia_diem_luu_giu?: string;
  ten_di_tich?: string;
  dong_ho_lien_quan?: string;
  gia_dinh_lien_quan?: string;
  nha_tho_ho?: string;
  giai_thich_noi_dung?: TextFieldWithStatus;
  ghi_chu_nghien_cuu?: TextFieldWithStatus;
  ngay_tiep_nhan?: string;
  lich_su_chinh_sua?: EditHistoryItem[];
  image_publication_allowed: boolean;
  image_restriction_reason: string;
  images: PublicImage[];
}

export type SourceType =
  | 'Ảnh chụp tại di tích'
  | 'Ảnh do dòng họ cung cấp'
  | 'Tư liệu của Ban quản lý'
  | 'Sách nghiên cứu'
  | 'Tài liệu Hán Nôm'
  | 'Hồ sơ di tích'
  | 'Bài báo'
  | 'Tài liệu lưu trữ'
  | 'Nguồn khác';

export interface ArchiveSource {
  ma_nguon: string;
  ten_nguon: string;
  loai_nguon: SourceType | string;
  tac_gia_hoac_nguoi_cung_cap: string;
  don_vi_hoac_ca_nhan_luu_giu?: string;
  cong_khai_nguoi_cung_cap?: boolean;
  dia_diem: string;
  ngay_tiep_nhan: string;
  nguoi_chup_anh?: string;
  nguoi_phien_am?: string;
  nguoi_kiem_chung?: string;
  tai_lieu_tham_khao?: string;
  tinh_trang_xac_minh: VerificationLevel;
  ho_so_lien_quan: string[];
  ghi_chu: string;
}

export interface TulieuDataset {
  metadata: {
    ten_du_an: string;
    phien_ban: string;
    ngay_tao: string;
    mo_ta: string;
  };
  records: ArchiveRecordRaw[];
  sources: ArchiveSource[];
}

export interface ArchiveStats {
  tong_ho_so: number;
  so_hoanh_phi: number;
  so_cau_doi: number;
  so_dia_diem_luu_giu: number;
  so_dong_ho: number;
  so_di_tich: number;
  so_da_kiem_chung: number;
  so_chua_kiem_chung: number;
  so_chua_doc_duoc: number;
  so_nguon_tu_lieu: number;
  recent_records?: PublicRecord[];
}

export interface FilterQuery {
  q?: string;
  type?: string;
  locationType?: string;
  thanhPho?: string;
  huyenLichSu?: string;
  xaHienNay?: string;
  xaLichSu?: string;
  thonLang?: string;
  dongHo?: string;
  nhaThoHo?: string;
  giaDinh?: string;
  currentRepository?: string;
  verification?: string;
  edition?: string;
  condition?: string;
  sort?: 'newest' | 'title_asc' | 'identifier_asc' | 'verified_first';
  page?: number;
  limit?: number;
}

export interface CitationItem {
  identifier: string;
  title: string;
  noi_luu_giu_hien_nay: string;
  loai_ban_dang_hien_thi: string;
  muc_kiem_chung: VerificationLevel;
}

export interface QAResponse {
  answer: string;
  found: boolean;
  configured: boolean;
  citations: CitationItem[];
  notice?: string;
}

export interface TranscriptionSuggestionResponse {
  configured: boolean;
  legible: boolean;
  label: string;
  suggestion: string;
  han_nom_detected?: string;
  phien_am_de_xuat?: string;
  dich_nghia_tham_khao?: string;
  notes?: string;
  error?: string;
}

export interface CitizenSubmissionInput {
  ten_tu_lieu: string;
  loai_tu_lieu: string;
  noi_luu_giu: string;
  loai_dia_diem: string;
  dia_danh_hien_nay: string;
  dia_danh_lich_su: string;
  thon_lang: string;
  dong_ho_hoac_gia_dinh: string;
  chu_han_nom: string;
  phien_am_de_xuat: string;
  dich_nghia_de_xuat?: string;
  nien_dai_de_xuat?: string;
  nguoi_cung_cap: string;
  lien_he: string;
  nguon_xac_minh: string;
  nguon_anh?: string;
  nguoi_cho_phep_cong_bo?: string;
  pham_vi_su_dung?: string;
  xac_nhan_quyen_cong_bo?: boolean;
  target_identifier?: string;
  loai_dong_gop?: 'ho_so_moi' | 'bo_sung_chinh_sua';
  ghi_chu: string;
}

export interface PendingImageItem {
  image_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  image_type: ImageType;
  caption: string;
  source: string;
  nguoi_cho_phep_cong_bo: string;
  pham_vi_duoc_phep: string;
  permission: ImagePermission;
}

export interface ReviewHistoryEntry {
  nguoi_duyet: string;
  tai_khoan: string;
  vai_tro: string;
  thoi_gian: string;
  trang_thai_truoc: ProcessingStatus;
  trang_thai_sau: ProcessingStatus;
  hanh_dong: string;
  ly_do: string;
}

export interface SubmissionRecord {
  submission_id: string;
  ngay_gui: string;
  ngay_cap_nhat: string;
  trang_thai_xu_ly: ProcessingStatus;
  loai_dong_gop: 'ho_so_moi' | 'bo_sung_chinh_sua';
  target_identifier?: string;
  official_identifier?: string;
  ten_tu_lieu: string;
  ten_goi_khac?: string;
  loai_tu_lieu: string;
  creator?: string;
  subject?: string[];
  description?: string;
  publisher?: string;
  format?: string;
  language?: string;
  relation?: string[];
  rights?: string;
  noi_luu_giu: string;
  noi_luu_giu_tai_thoi_diem_tu_lieu?: string;
  loai_dia_diem: string;
  ten_di_tich?: string;
  nha_tho_ho?: string;
  dia_danh_hien_nay: string;
  phuong_xa_hien_nay?: string;
  dia_danh_lich_su: string;
  phuong_xa_lich_su?: string;
  thon_lang: string;
  dong_ho_hoac_gia_dinh: string;
  gia_dinh_lien_quan?: string;
  loai_ban_dang_hien_thi?: string;
  tinh_trang_ban_goc?: string;
  so_dang_ky?: string;
  chu_han_nom: string;
  phien_am_de_xuat: string;
  dich_nghia_de_xuat: string;
  giai_thich_noi_dung?: string;
  nien_dai_de_xuat: string;
  nguoi_cung_cap: string;
  cong_khai_nguoi_cung_cap: boolean;
  lien_he: string;
  nguon_xac_minh: string;
  nguon_anh: string;
  nguoi_cho_phep_cong_bo: string;
  pham_vi_su_dung: string;
  phan_khong_cong_bo?: string;
  xac_nhan_quyen_cong_bo: boolean;
  ghi_chu: string;
  ghi_chu_kiem_duyet?: string;
  ly_do_xu_ly?: string;
  nguoi_xu_ly?: string;
  muc_kiem_chung?: VerificationLevel;
  kiem_chung_chi_tiet: GranularVerification;
  pending_images: PendingImageItem[];
  lich_su_duyet?: ReviewHistoryEntry[];
}

export interface UserAccountSafe {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'REVIEWER';
  can_publish: boolean;
  is_locked: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface AuditLogEntry {
  log_id: string;
  ma_ho_so: string;
  tai_khoan: string;
  vai_tro: string;
  thoi_gian: string;
  hanh_dong: string;
  noi_dung_truoc: string;
  noi_dung_sau: string;
  ly_do: string;
}
