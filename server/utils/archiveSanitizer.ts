import type {
  ArchiveImageRaw,
  ArchiveRecordRaw,
  ArchiveSource,
  GranularVerification,
  PublicImage,
  PublicRecord,
  VerificationLevel,
} from '../../src/types/archive.ts';

export const IMAGE_RESTRICTION_MESSAGE =
  'Tư liệu đang chờ xác nhận quyền công bố. Vui lòng quay lại sau.';

export function normalizeVietnamese(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function normalizeVerification(
  status: string | undefined | null
): VerificationLevel {
  if (
    status === 'da_kiem_chung' ||
    status === 'chua_kiem_chung' ||
    status === 'chua_doc_duoc'
  ) {
    return status;
  }
  return 'chua_kiem_chung';
}

export function normalizeGranularVerification(
  input?: Partial<GranularVerification>
): GranularVerification {
  return {
    dia_diem: normalizeVerification(input?.dia_diem),
    nguon_tu_lieu: normalizeVerification(input?.nguon_tu_lieu),
    chu_han_nom: normalizeVerification(input?.chu_han_nom),
    phien_am: normalizeVerification(input?.phien_am),
    dich_nghia: normalizeVerification(input?.dich_nghia),
    nien_dai: normalizeVerification(input?.nien_dai),
  };
}

export function hasRecordPublicationAuthority(
  record: ArchiveRecordRaw
): boolean {
  const authorizer = (record.nguoi_cho_phep_cong_bo || '').trim();
  const scope = (record.pham_vi_duoc_phep || '').trim();
  if (!authorizer || !scope) return false;
  const normalizedScope = normalizeVietnamese(scope);
  if (
    normalizedScope === 'khong cong bo' ||
    normalizedScope === 'khong_cong_bo' ||
    normalizedScope === 'noi bo'
  ) {
    return false;
  }
  return true;
}

export function isImagePublicationAllowed(
  record: ArchiveRecordRaw,
  image: ArchiveImageRaw
): boolean {
  if (!hasRecordPublicationAuthority(record)) return false;
  if (image.permission !== 'duoc_phep_cong_bo') return false;
  return Boolean((image.thumbnail || image.file || '').trim());
}

export function isRecordPubliclyExportable(record: ArchiveRecordRaw): boolean {
  if (record.trang_thai_xu_ly && record.trang_thai_xu_ly !== 'DA_CONG_KHAI') {
    return false;
  }
  const scope = normalizeVietnamese(record.pham_vi_duoc_phep);
  const rights = normalizeVietnamese(record.rights);
  if (scope === 'khong cong bo' || scope === 'khong_cong_bo') return false;
  if (rights === 'khong cong bo' || rights === 'khong_cong_bo') return false;
  return true;
}

export function sanitizeRecordForPublic(
  record: ArchiveRecordRaw
): PublicRecord {
  const canShowProvider = record.cong_khai_nguoi_cung_cap === true;
  const recordAllowsImages = hasRecordPublicationAuthority(record);
  const rawImages = Array.isArray(record.images) ? record.images : [];

  const allowedImages: PublicImage[] = [];
  if (recordAllowsImages) {
    for (const img of rawImages) {
      if (isImagePublicationAllowed(record, img)) {
        const encRec = encodeURIComponent(record.identifier);
        const encImg = encodeURIComponent(img.image_id);
        allowedImages.push({
          image_id: img.image_id,
          image_type: img.image_type || 'toan_trang',
          caption: img.caption || '',
          source: img.source || '',
          thumbnail_url: `/api/images/${encRec}/${encImg}?variant=thumbnail`,
          original_url: `/api/images/${encRec}/${encImg}?variant=original`,
        });
      }
    }
  }

  return {
    identifier: record.identifier || '',
    title: record.title || '',
    ten_goi_khac: record.ten_goi_khac || '',
    creator: record.creator || '',
    subject: Array.isArray(record.subject) ? record.subject : [],
    description: record.description || '',
    publisher: record.publisher || '',
    contributor:
      canShowProvider && Array.isArray(record.contributor)
        ? record.contributor
        : [],
    date: record.date || '',
    type: record.type || '',
    format: record.format || '',
    source: Array.isArray(record.source) ? record.source : [],
    language: record.language || '',
    relation: Array.isArray(record.relation) ? record.relation : [],
    coverage: {
      thanh_pho: record.coverage?.thanh_pho || 'Hà Nội',
      don_vi_hanh_chinh_hien_nay:
        record.coverage?.don_vi_hanh_chinh_hien_nay || '',
      don_vi_hanh_chinh_lich_su:
        record.coverage?.don_vi_hanh_chinh_lich_su || '',
      phuong_xa_hien_nay: record.coverage?.phuong_xa_hien_nay || '',
      phuong_xa_lich_su: record.coverage?.phuong_xa_lich_su || '',
      thon_lang: record.coverage?.thon_lang || '',
      thoi_gian: record.coverage?.thoi_gian || '',
    },
    rights: record.rights || '',
    noi_luu_giu_hien_nay: record.noi_luu_giu_hien_nay || '',
    noi_luu_giu_tai_thoi_diem_tu_lieu:
      record.noi_luu_giu_tai_thoi_diem_tu_lieu || '',
    loai_ban_dang_hien_thi: record.loai_ban_dang_hien_thi || '',
    tinh_trang_ban_goc: record.tinh_trang_ban_goc || '',
    so_dang_ky: record.so_dang_ky || '',
    nguoi_cho_phep_cong_bo: record.nguoi_cho_phep_cong_bo || '',
    pham_vi_duoc_phep: record.pham_vi_duoc_phep || '',
    co_phan_khong_cong_bo: Boolean((record.phan_khong_cong_bo || '').trim()),
    muc_kiem_chung: normalizeVerification(record.muc_kiem_chung),
    kiem_chung_chi_tiet: record.kiem_chung_chi_tiet
      ? normalizeGranularVerification(record.kiem_chung_chi_tiet)
      : undefined,
    trang_thai_xu_ly: record.trang_thai_xu_ly || 'DA_CONG_KHAI',
    chu_han_nom: record.chu_han_nom || '',
    phien_am: {
      noi_dung: record.phien_am?.noi_dung || '',
      trang_thai: normalizeVerification(record.phien_am?.trang_thai),
    },
    dich_nghia: {
      noi_dung: record.dich_nghia?.noi_dung || '',
      trang_thai: normalizeVerification(record.dich_nghia?.trang_thai),
    },
    ghi_chu: record.ghi_chu || '',
    ngay_cap_nhat: record.ngay_cap_nhat || '',
    loai_dia_diem_luu_giu: record.loai_dia_diem_luu_giu || '',
    ten_di_tich: record.ten_di_tich || '',
    dong_ho_lien_quan: record.dong_ho_lien_quan || '',
    gia_dinh_lien_quan: record.gia_dinh_lien_quan || '',
    nha_tho_ho: record.nha_tho_ho || '',
    giai_thich_noi_dung: record.giai_thich_noi_dung
      ? {
          noi_dung: record.giai_thich_noi_dung.noi_dung || '',
          trang_thai: normalizeVerification(
            record.giai_thich_noi_dung.trang_thai
          ),
        }
      : undefined,
    ghi_chu_nghien_cuu: record.ghi_chu_nghien_cuu
      ? {
          noi_dung: record.ghi_chu_nghien_cuu.noi_dung || '',
          trang_thai: normalizeVerification(
            record.ghi_chu_nghien_cuu.trang_thai
          ),
        }
      : undefined,
    ngay_tiep_nhan: record.ngay_tiep_nhan || '',
    lich_su_chinh_sua: Array.isArray(record.lich_su_chinh_sua)
      ? record.lich_su_chinh_sua
      : [],
    image_publication_allowed: allowedImages.length > 0,
    image_restriction_reason:
      allowedImages.length > 0
        ? ''
        : rawImages.length > 0 || !recordAllowsImages
          ? IMAGE_RESTRICTION_MESSAGE
          : 'Hồ sơ văn bản đã kiểm chứng (chưa đính kèm hình ảnh tư liệu).',
    images: allowedImages,
  };
}

export function sanitizeSourceForPublic(source: ArchiveSource): ArchiveSource {
  const canShowPerson = source.cong_khai_nguoi_cung_cap === true;
  return {
    ma_nguon: source.ma_nguon || '',
    ten_nguon: source.ten_nguon || '',
    loai_nguon: source.loai_nguon || 'Nguồn khác',
    tac_gia_hoac_nguoi_cung_cap: canShowPerson
      ? source.tac_gia_hoac_nguoi_cung_cap || ''
      : 'Ẩn theo quy định bảo vệ thông tin cá nhân',
    don_vi_hoac_ca_nhan_luu_giu: source.don_vi_hoac_ca_nhan_luu_giu || '',
    cong_khai_nguoi_cung_cap: canShowPerson,
    dia_diem: source.dia_diem || '',
    ngay_tiep_nhan: source.ngay_tiep_nhan || '',
    nguoi_chup_anh: canShowPerson ? source.nguoi_chup_anh || '' : '',
    nguoi_phien_am: source.nguoi_phien_am || '',
    nguoi_kiem_chung: source.nguoi_kiem_chung || '',
    tai_lieu_tham_khao: source.tai_lieu_tham_khao || '',
    tinh_trang_xac_minh: normalizeVerification(source.tinh_trang_xac_minh),
    ho_so_lien_quan: Array.isArray(source.ho_so_lien_quan)
      ? source.ho_so_lien_quan
      : [],
    ghi_chu: source.ghi_chu || '',
  };
}

export function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
