import type {
  ArchiveRecordRaw,
  GranularVerification,
  ProcessingStatus,
  VerificationLevel,
} from '../../src/types/archive.ts';
import {
  hasRecordPublicationAuthority,
  normalizeGranularVerification,
  normalizeVerification,
} from '../utils/archiveSanitizer.ts';

export interface ImportErrorItem {
  row: number;
  identifier: string;
  message: string;
}

export interface ImportPreviewResult {
  format: 'json' | 'csv';
  totalRows: number;
  validRecords: ArchiveRecordRaw[];
  errors: ImportErrorItem[];
  duplicateIdentifiers: string[];
}

function parseCsvRows(rawCsv: string): string[][] {
  const cleaned = rawCsv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function splitList(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function strVal(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function mapRawItemToArchiveRecord(
  raw: Record<string, unknown>,
  canPublish: boolean
): ArchiveRecordRaw {
  const todayStr = new Date().toISOString().slice(0, 10);
  const identifier = strVal(raw, 'identifier', 'Mã định danh (identifier)', 'ma_dinh_danh');
  const title = strVal(raw, 'title', 'Tên tư liệu (title)', 'ten_tu_lieu');
  const currentRepo = strVal(
    raw,
    'noi_luu_giu_hien_nay',
    'currentRepository',
    'Nơi lưu giữ hiện nay'
  );

  const phienAmRaw = raw.phien_am as Record<string, unknown> | string | undefined;
  const dichNghiaRaw = raw.dich_nghia as Record<string, unknown> | string | undefined;
  const coverageRaw = (raw.coverage as Record<string, unknown>) || {};

  const phienAmText =
    typeof phienAmRaw === 'object' && phienAmRaw !== null
      ? strVal(phienAmRaw, 'noi_dung')
      : strVal(raw, 'transcription', 'phien_am', 'Phiên âm Hán Việt');

  const dichNghiaText =
    typeof dichNghiaRaw === 'object' && dichNghiaRaw !== null
      ? strVal(dichNghiaRaw, 'noi_dung')
      : strVal(raw, 'translation', 'dich_nghia', 'Dịch nghĩa tiếng Việt');

  const overallVerification: VerificationLevel = normalizeVerification(
    strVal(raw, 'muc_kiem_chung', 'verificationStatus', 'Mức kiểm chứng tổng thể')
  );

  const phienAmStatus: VerificationLevel = normalizeVerification(
    (typeof phienAmRaw === 'object' && phienAmRaw !== null
      ? String(phienAmRaw.trang_thai || '')
      : '') ||
      strVal(
        raw,
        'transcriptionVerification',
        'Trạng thái phiên âm'
      ) ||
      overallVerification
  );

  const dichNghiaStatus: VerificationLevel = normalizeVerification(
    (typeof dichNghiaRaw === 'object' && dichNghiaRaw !== null
      ? String(dichNghiaRaw.trang_thai || '')
      : '') ||
      strVal(
        raw,
        'translationVerification',
        'Trạng thái dịch nghĩa'
      ) ||
      overallVerification
  );

  const rawGranular = raw.kiem_chung_chi_tiet as
    | Partial<GranularVerification>
    | undefined;
  const granular = normalizeGranularVerification({
    dia_diem: rawGranular?.dia_diem || overallVerification,
    nguon_tu_lieu: rawGranular?.nguon_tu_lieu || overallVerification,
    chu_han_nom: rawGranular?.chu_han_nom || overallVerification,
    phien_am: rawGranular?.phien_am || phienAmStatus,
    dich_nghia: rawGranular?.dich_nghia || dichNghiaStatus,
    nien_dai: rawGranular?.nien_dai || overallVerification,
  });

  const requestedStatus = strVal(raw, 'trang_thai_xu_ly') as ProcessingStatus;
  let finalStatus: ProcessingStatus = 'CHO_CONG_KHAI';
  if (requestedStatus === 'DA_CONG_KHAI' && canPublish) {
    finalStatus = 'DA_CONG_KHAI';
  } else if (
    requestedStatus === 'DA_XAC_NHAN' ||
    requestedStatus === 'CHO_CONG_KHAI'
  ) {
    finalStatus = requestedStatus;
  } else if (!requestedStatus && canPublish) {
    finalStatus = 'DA_CONG_KHAI';
  }

  const record: ArchiveRecordRaw = {
    identifier,
    title,
    ten_goi_khac: strVal(raw, 'ten_goi_khac', 'Tên gọi khác'),
    creator: strVal(raw, 'creator', 'Người tạo lập (creator)'),
    subject: splitList(raw.subject ?? raw['Chủ đề (subject)']),
    description: strVal(raw, 'description', 'Mô tả (description)'),
    publisher:
      strVal(raw, 'publisher', 'Đơn vị công bố (publisher)') ||
      'Hồ sơ số Hoành phi – Câu đối Hà Nội',
    contributor: splitList(
      raw.contributor ?? raw['Người đóng góp được công bố (contributor)']
    ),
    date: strVal(raw, 'date', 'Thời gian tạo lập (date)'),
    type: strVal(raw, 'type', 'Loại tài nguyên (type)') || 'Hoành phi',
    format: strVal(raw, 'format', 'Định dạng (format)'),
    source: splitList(raw.source ?? raw['Nguồn tư liệu (source)']),
    language:
      strVal(raw, 'language', 'Ngôn ngữ (language)') ||
      'Chữ Hán/Nôm, Tiếng Việt',
    relation: splitList(raw.relation ?? raw['Tư liệu liên quan (relation)']),
    coverage: {
      thanh_pho:
        strVal(coverageRaw, 'thanh_pho') ||
        strVal(raw, 'Thành phố') ||
        'Hà Nội',
      don_vi_hanh_chinh_hien_nay:
        strVal(coverageRaw, 'don_vi_hanh_chinh_hien_nay') ||
        strVal(
          raw,
          'administrativeArea',
          'Đơn vị hành chính hiện nay'
        ),
      don_vi_hanh_chinh_lich_su:
        strVal(coverageRaw, 'don_vi_hanh_chinh_lich_su') ||
        strVal(raw, 'Đơn vị hành chính lịch sử'),
      phuong_xa_hien_nay:
        strVal(coverageRaw, 'phuong_xa_hien_nay') ||
        strVal(raw, 'Phường/Xã hiện nay'),
      phuong_xa_lich_su:
        strVal(coverageRaw, 'phuong_xa_lich_su') ||
        strVal(raw, 'Phường/Xã lịch sử'),
      thon_lang:
        strVal(coverageRaw, 'thon_lang') ||
        strVal(raw, 'villageName', 'Thôn/Làng'),
      thoi_gian:
        strVal(coverageRaw, 'thoi_gian') || strVal(raw, 'Thời gian địa bàn'),
    },
    rights: strVal(raw, 'rights', 'Quyền sử dụng (rights)'),
    noi_luu_giu_hien_nay: currentRepo,
    noi_luu_giu_tai_thoi_diem_tu_lieu:
      strVal(
        raw,
        'noi_luu_giu_tai_thoi_diem_tu_lieu',
        'historicalRepository',
        'Nơi lưu giữ tại thời điểm tư liệu'
      ) || currentRepo,
    loai_ban_dang_hien_thi:
      strVal(
        raw,
        'loai_ban_dang_hien_thi',
        'displayedCopyType',
        'Loại bản đang hiển thị'
      ) || 'Bản phiên âm',
    tinh_trang_ban_goc:
      strVal(
        raw,
        'tinh_trang_ban_goc',
        'originalCondition',
        'Tình trạng bản gốc'
      ) || 'Không xác định',
    so_dang_ky: strVal(
      raw,
      'so_dang_ky',
      'registrationNumber',
      'Số đăng ký'
    ),
    nguoi_cho_phep_cong_bo: strVal(
      raw,
      'nguoi_cho_phep_cong_bo',
      'publicationPermission',
      'Người cho phép công bố'
    ),
    pham_vi_duoc_phep: strVal(
      raw,
      'pham_vi_duoc_phep',
      'permittedScope',
      'Phạm vi được phép'
    ),
    phan_khong_cong_bo: strVal(
      raw,
      'phan_khong_cong_bo',
      'restrictedContent'
    ),
    muc_kiem_chung: overallVerification,
    trang_thai_xu_ly: finalStatus,
    kiem_chung_chi_tiet: granular,
    images: [],
    chu_han_nom: strVal(
      raw,
      'chu_han_nom',
      'originalText',
      'Chữ Hán/Nôm nguyên bản'
    ),
    phien_am: {
      noi_dung: phienAmText,
      trang_thai: phienAmStatus,
    },
    dich_nghia: {
      noi_dung: dichNghiaText,
      trang_thai: dichNghiaStatus,
    },
    giai_thich_noi_dung: strVal(raw, 'explanation')
      ? {
          noi_dung: strVal(raw, 'explanation'),
          trang_thai: overallVerification,
        }
      : undefined,
    ghi_chu: strVal(raw, 'ghi_chu', 'Ghi chú'),
    ngay_cap_nhat: strVal(raw, 'ngay_cap_nhat', 'Ngày cập nhật') || todayStr,
    loai_dia_diem_luu_giu: strVal(
      raw,
      'loai_dia_diem_luu_giu',
      'heritageType',
      'Loại địa điểm lưu giữ'
    ),
    ten_di_tich: strVal(raw, 'ten_di_tich'),
    dong_ho_lien_quan: strVal(
      raw,
      'dong_ho_lien_quan',
      'clanName',
      'Dòng họ liên quan'
    ),
    gia_dinh_lien_quan: strVal(
      raw,
      'gia_dinh_lien_quan',
      'familyName',
      'Gia đình liên quan'
    ),
    nha_tho_ho: strVal(raw, 'nha_tho_ho', 'Nhà thờ họ'),
    ngay_tiep_nhan: strVal(raw, 'ngay_tiep_nhan') || todayStr,
    cong_khai_nguoi_cung_cap: Boolean(raw.cong_khai_nguoi_cung_cap),
  };

  if (!hasRecordPublicationAuthority(record)) {
    record.images = [];
  }

  return record;
}

export function previewBulkImport(
  format: 'json' | 'csv',
  content: string,
  existingRecords: ArchiveRecordRaw[],
  canPublish: boolean
): ImportPreviewResult {
  const existingIds = new Set(existingRecords.map((r) => r.identifier));
  const seenInBatch = new Set<string>();
  const validRecords: ArchiveRecordRaw[] = [];
  const errors: ImportErrorItem[] = [];
  const duplicateIdentifiers: string[] = [];

  let rawObjects: Array<Record<string, unknown>> = [];

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        format,
        totalRows: 0,
        validRecords: [],
        errors: [
          {
            row: 0,
            identifier: '',
            message: 'Tệp JSON không đúng cú pháp hợp lệ.',
          },
        ],
        duplicateIdentifiers: [],
      };
    }

    if (Array.isArray(parsed)) {
      rawObjects = parsed as Array<Record<string, unknown>>;
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as { records?: unknown }).records)
    ) {
      rawObjects = (parsed as { records: Array<Record<string, unknown>> })
        .records;
    } else {
      return {
        format,
        totalRows: 0,
        validRecords: [],
        errors: [
          {
            row: 0,
            identifier: '',
            message:
              'Cấu trúc JSON phải là một mảng bản ghi hoặc đối tượng chứa thuộc tính "records".',
          },
        ],
        duplicateIdentifiers: [],
      };
    }
  } else {
    const matrix = parseCsvRows(content);
    if (matrix.length < 2) {
      return {
        format,
        totalRows: 0,
        validRecords: [],
        errors: [
          {
            row: 0,
            identifier: '',
            message:
              'Tệp CSV phải có dòng tiêu đề và ít nhất một dòng dữ liệu.',
          },
        ],
        duplicateIdentifiers: [],
      };
    }
    const headers = matrix[0].map((h) => h.trim());
    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = (cells[idx] || '').trim();
      });
      rawObjects.push(obj);
    }
  }

  rawObjects.forEach((raw, idx) => {
    const rowNum = idx + 1;
    if (!raw || typeof raw !== 'object') {
      errors.push({
        row: rowNum,
        identifier: '',
        message: 'Dòng dữ liệu không phải đối tượng hợp lệ.',
      });
      return;
    }

    const mapped = mapRawItemToArchiveRecord(raw, canPublish);

    if (!mapped.identifier) {
      errors.push({
        row: rowNum,
        identifier: '',
        message: 'Thiếu trường bắt buộc: identifier (Mã định danh).',
      });
      return;
    }
    if (!mapped.title) {
      errors.push({
        row: rowNum,
        identifier: mapped.identifier,
        message: 'Thiếu trường bắt buộc: title (Tên tư liệu).',
      });
      return;
    }
    if (!mapped.noi_luu_giu_hien_nay) {
      errors.push({
        row: rowNum,
        identifier: mapped.identifier,
        message:
          'Thiếu trường bắt buộc: noi_luu_giu_hien_nay / currentRepository (Nơi lưu giữ hiện nay).',
      });
      return;
    }

    if (existingIds.has(mapped.identifier) || seenInBatch.has(mapped.identifier)) {
      duplicateIdentifiers.push(mapped.identifier);
      errors.push({
        row: rowNum,
        identifier: mapped.identifier,
        message: `Mã định danh "${mapped.identifier}" bị trùng lặp với dữ liệu hiện có hoặc trong chính tệp nhập.`,
      });
      return;
    }

    seenInBatch.add(mapped.identifier);
    validRecords.push(mapped);
  });

  return {
    format,
    totalRows: rawObjects.length,
    validRecords,
    errors,
    duplicateIdentifiers,
  };
}
