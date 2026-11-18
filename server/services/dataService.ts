import fs from 'node:fs/promises';
import path from 'node:path';
import { serverConfig } from '../config/env.ts';
import type {
  ArchiveRecordRaw,
  ArchiveSource,
  ArchiveStats,
  CitizenSubmissionInput,
  FilterQuery,
  PublicRecord,
  TulieuDataset,
} from '../../src/types/archive.ts';
import {
  isRecordPubliclyExportable,
  normalizeVerification,
  normalizeVietnamese,
  sanitizeRecordForPublic,
  sanitizeSourceForPublic,
} from '../utils/archiveSanitizer.ts';

const EMPTY_DATASET: TulieuDataset = {
  metadata: {
    ten_du_an: 'Hồ sơ số Hoành phi - Câu đối Hà Nội',
    phien_ban: '1.0',
    ngay_tao: '',
    mo_ta:
      'Cơ sở dữ liệu hồ sơ số hoành phi, câu đối trên địa bàn thành phố Hà Nội',
  },
  records: [],
  sources: [],
};

export async function readDataset(): Promise<TulieuDataset> {
  try {
    const raw = await fs.readFile(serverConfig.dataFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TulieuDataset>;
    return {
      metadata: parsed.metadata ?? EMPTY_DATASET.metadata,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return EMPTY_DATASET;
    }
    throw err;
  }
}

export function computeStats(dataset: TulieuDataset): ArchiveStats {
  const publicRecords = dataset.records.filter(isRecordPubliclyExportable);
  let hoanhPhiCount = 0;
  let cauDoiCount = 0;
  let verifiedCount = 0;
  let unverifiedCount = 0;
  let illegibleCount = 0;
  const locationSet = new Set<string>();

  for (const r of publicRecords) {
    const t = normalizeVietnamese(r.type);
    if (t.includes('hoanh phi')) hoanhPhiCount += 1;
    if (t.includes('cau doi')) cauDoiCount += 1;

    const status = normalizeVerification(r.muc_kiem_chung);
    if (status === 'da_kiem_chung') verifiedCount += 1;
    else if (status === 'chua_doc_duoc') illegibleCount += 1;
    else unverifiedCount += 1;

    const loc = (r.noi_luu_giu_hien_nay || '').trim();
    if (loc) locationSet.add(normalizeVietnamese(loc));
  }

  return {
    tong_ho_so: publicRecords.length,
    so_hoanh_phi: hoanhPhiCount,
    so_cau_doi: cauDoiCount,
    so_dia_diem_luu_giu: locationSet.size,
    so_da_kiem_chung: verifiedCount,
    so_chua_kiem_chung: unverifiedCount,
    so_chua_doc_duoc: illegibleCount,
    so_nguon_tu_lieu: dataset.sources.length,
  };
}

function matchesText(haystack: string | undefined, needle: string): boolean {
  if (!needle) return true;
  if (!haystack) return false;
  return (
    haystack.toLowerCase().includes(needle.toLowerCase()) ||
    normalizeVietnamese(haystack).includes(normalizeVietnamese(needle))
  );
}

export function filterPublicRecords(
  rawRecords: ArchiveRecordRaw[],
  query: FilterQuery
): { items: PublicRecord[]; total: number; facets: Record<string, string[]> } {
  const publicRaw = rawRecords.filter(isRecordPubliclyExportable);

  const huyenSet = new Set<string>();
  const xaHienNaySet = new Set<string>();
  const xaLichSuSet = new Set<string>();
  const thonLangSet = new Set<string>();

  for (const r of publicRaw) {
    if (r.coverage?.don_vi_hanh_chinh_lich_su) {
      huyenSet.add(r.coverage.don_vi_hanh_chinh_lich_su);
    }
    if (r.coverage?.phuong_xa_hien_nay) {
      xaHienNaySet.add(r.coverage.phuong_xa_hien_nay);
    }
    if (r.coverage?.phuong_xa_lich_su) {
      xaLichSuSet.add(r.coverage.phuong_xa_lich_su);
    }
    if (r.coverage?.thon_lang) {
      thonLangSet.add(r.coverage.thon_lang);
    }
  }

  const filtered = publicRaw.filter((r) => {
    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      const searchableFields = [
        r.identifier,
        r.title,
        r.chu_han_nom,
        r.phien_am?.noi_dung,
        r.dich_nghia?.noi_dung,
        r.noi_luu_giu_hien_nay,
        r.noi_luu_giu_tai_thoi_diem_tu_lieu,
        r.ten_di_tich,
        r.nha_tho_ho,
        r.dong_ho_lien_quan,
        r.gia_dinh_lien_quan,
        r.description,
        r.coverage?.thanh_pho,
        r.coverage?.don_vi_hanh_chinh_hien_nay,
        r.coverage?.don_vi_hanh_chinh_lich_su,
        r.coverage?.phuong_xa_hien_nay,
        r.coverage?.phuong_xa_lich_su,
        r.coverage?.thon_lang,
        ...(Array.isArray(r.subject) ? r.subject : []),
      ];
      if (!searchableFields.some((f) => matchesText(f, q))) {
        return false;
      }
    }

    if (query.type && query.type.trim()) {
      const target = normalizeVietnamese(query.type);
      const recordType = normalizeVietnamese(r.type);
      if (target === 'tu lieu khac') {
        if (
          recordType.includes('hoanh phi') ||
          recordType.includes('cau doi')
        ) {
          return false;
        }
      } else if (!recordType.includes(target)) {
        return false;
      }
    }

    if (query.locationType && query.locationType.trim()) {
      const target = normalizeVietnamese(query.locationType);
      const locType = normalizeVietnamese(
        r.loai_dia_diem_luu_giu || r.noi_luu_giu_hien_nay
      );
      if (target === 'khac') {
        const known = [
          'dinh',
          'chua',
          'den',
          'mieu',
          'nha tho ho',
          'tu duong',
        ];
        if (known.some((k) => locType.includes(k))) return false;
      } else if (target === 'den_mieu') {
        if (!locType.includes('den') && !locType.includes('mieu')) return false;
      } else if (target === 'nha_tho_ho_tu_duong') {
        if (!locType.includes('nha tho ho') && !locType.includes('tu duong'))
          return false;
      } else if (!locType.includes(target)) {
        return false;
      }
    }

    if (query.thanhPho && query.thanhPho.trim()) {
      if (!matchesText(r.coverage?.thanh_pho, query.thanhPho)) return false;
    }

    if (query.huyenLichSu && query.huyenLichSu.trim()) {
      const matchLichSu = matchesText(
        r.coverage?.don_vi_hanh_chinh_lich_su,
        query.huyenLichSu
      );
      const matchHienNay = matchesText(
        r.coverage?.don_vi_hanh_chinh_hien_nay,
        query.huyenLichSu
      );
      if (!matchLichSu && !matchHienNay) return false;
    }

    if (query.xaHienNay && query.xaHienNay.trim()) {
      if (!matchesText(r.coverage?.phuong_xa_hien_nay, query.xaHienNay)) {
        return false;
      }
    }

    if (query.xaLichSu && query.xaLichSu.trim()) {
      if (!matchesText(r.coverage?.phuong_xa_lich_su, query.xaLichSu)) {
        return false;
      }
    }

    if (query.thonLang && query.thonLang.trim()) {
      if (!matchesText(r.coverage?.thon_lang, query.thonLang)) return false;
    }

    if (query.dongHo && query.dongHo.trim()) {
      if (
        !matchesText(r.dong_ho_lien_quan, query.dongHo) &&
        !matchesText(r.nha_tho_ho, query.dongHo) &&
        !matchesText(r.gia_dinh_lien_quan, query.dongHo)
      ) {
        return false;
      }
    }

    if (query.nhaThoHo && query.nhaThoHo.trim()) {
      if (
        !matchesText(r.nha_tho_ho, query.nhaThoHo) &&
        !matchesText(r.noi_luu_giu_hien_nay, query.nhaThoHo)
      ) {
        return false;
      }
    }

    if (query.giaDinh && query.giaDinh.trim()) {
      if (!matchesText(r.gia_dinh_lien_quan, query.giaDinh)) return false;
    }

    if (query.verification && query.verification.trim()) {
      if (normalizeVerification(r.muc_kiem_chung) !== query.verification) {
        return false;
      }
    }

    if (query.edition && query.edition.trim()) {
      if (!matchesText(r.loai_ban_dang_hien_thi, query.edition)) {
        return false;
      }
    }

    if (query.condition && query.condition.trim()) {
      if (!matchesText(r.tinh_trang_ban_goc, query.condition)) {
        return false;
      }
    }

    return true;
  });

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit).map(sanitizeRecordForPublic);

  return {
    items: paged,
    total: filtered.length,
    facets: {
      huyenLichSu: Array.from(huyenSet).sort(),
      xaHienNay: Array.from(xaHienNaySet).sort(),
      xaLichSu: Array.from(xaLichSuSet).sort(),
      thonLang: Array.from(thonLangSet).sort(),
    },
  };
}

export function getPublicSources(dataset: TulieuDataset): ArchiveSource[] {
  const allowedIds = new Set(
    dataset.records
      .filter(isRecordPubliclyExportable)
      .map((r) => r.identifier)
  );
  return dataset.sources.map((s) => {
    const clean = sanitizeSourceForPublic(s);
    clean.ho_so_lien_quan = clean.ho_so_lien_quan.filter((id) =>
      allowedIds.has(id)
    );
    return clean;
  });
}

export async function saveSubmission(input: CitizenSubmissionInput): Promise<{
  id: string;
  ngay_gui: string;
}> {
  const dir = path.dirname(serverConfig.submissionsFilePath);
  await fs.mkdir(dir, { recursive: true });

  let current: { submissions: unknown[] } = { submissions: [] };
  try {
    const raw = await fs.readFile(serverConfig.submissionsFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { submissions?: unknown[] };
    if (Array.isArray(parsed.submissions)) {
      current = { submissions: parsed.submissions };
    }
  } catch {
    current = { submissions: [] };
  }

  const entry = {
    submission_id: `DG-${Date.now()}`,
    ngay_gui: new Date().toISOString(),
    trang_thai: 'cho_ban_quan_ly_xem_xet',
    ...input,
  };
  current.submissions.push(entry);

  await fs.writeFile(
    serverConfig.submissionsFilePath,
    JSON.stringify(current, null, 2),
    'utf8'
  );

  return { id: entry.submission_id, ngay_gui: entry.ngay_gui };
}
