import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { serverConfig } from '../config/env.ts';
import type {
  ArchiveImageRaw,
  ArchiveRecordRaw,
  ArchiveSource,
  ArchiveStats,
  CitizenSubmissionInput,
  FilterQuery,
  GranularVerification,
  PendingImageItem,
  ProcessingStatus,
  PublicRecord,
  SubmissionRecord,
  TulieuDataset,
  VerificationLevel,
} from '../../src/types/archive.ts';
import {
  hasRecordPublicationAuthority,
  isRecordPubliclyExportable,
  normalizeGranularVerification,
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

export async function writeDataset(dataset: TulieuDataset): Promise<void> {
  await fs.mkdir(path.dirname(serverConfig.dataFilePath), { recursive: true });
  await fs.writeFile(
    serverConfig.dataFilePath,
    JSON.stringify(dataset, null, 2),
    'utf8'
  );
}

export async function readSubmissions(): Promise<SubmissionRecord[]> {
  try {
    const raw = await fs.readFile(serverConfig.submissionsFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { submissions?: SubmissionRecord[] };
    return Array.isArray(parsed.submissions) ? parsed.submissions : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function writeSubmissions(
  submissions: SubmissionRecord[]
): Promise<void> {
  await fs.mkdir(path.dirname(serverConfig.submissionsFilePath), {
    recursive: true,
  });
  await fs.writeFile(
    serverConfig.submissionsFilePath,
    JSON.stringify({ submissions }, null, 2),
    'utf8'
  );
}

export async function createReducedDisplayImage(
  srcPath: string,
  destThumbPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(destThumbPath), { recursive: true });
  try {
    await sharp(srcPath)
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFile(destThumbPath);
  } catch {
    // Safe fallback if input buffer is tiny or unsupported variant
    await fs.copyFile(srcPath, destThumbPath);
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
  const clanSet = new Set<string>();
  const siteSet = new Set<string>();

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

    const clan = (r.dong_ho_lien_quan || '').trim();
    if (clan) clanSet.add(normalizeVietnamese(clan));

    const site = (r.ten_di_tich || r.nha_tho_ho || r.noi_luu_giu_hien_nay || '').trim();
    if (site) siteSet.add(normalizeVietnamese(site));
  }

  const recentRecords = [...publicRecords]
    .sort((a, b) =>
      (b.ngay_cap_nhat || b.ngay_tiep_nhan || '').localeCompare(
        a.ngay_cap_nhat || a.ngay_tiep_nhan || ''
      )
    )
    .slice(0, 4)
    .map(sanitizeRecordForPublic);

  return {
    tong_ho_so: publicRecords.length,
    so_hoanh_phi: hoanhPhiCount,
    so_cau_doi: cauDoiCount,
    so_dia_diem_luu_giu: locationSet.size,
    so_dong_ho: clanSet.size,
    so_di_tich: siteSet.size,
    so_da_kiem_chung: verifiedCount,
    so_chua_kiem_chung: unverifiedCount,
    so_chua_doc_duoc: illegibleCount,
    so_nguon_tu_lieu: dataset.sources.length,
    recent_records: recentRecords,
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
  const repoSet = new Set<string>();

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
    if (r.noi_luu_giu_hien_nay) {
      repoSet.add(r.noi_luu_giu_hien_nay);
    }
  }

  const filtered = publicRaw.filter((r) => {
    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      const searchableFields = [
        r.identifier,
        r.title,
        r.ten_goi_khac,
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
      if (!matchesText(r.tinh_trang_ban_goc, query.condition)) return false;
    }

    if (query.currentRepository && query.currentRepository.trim()) {
      if (!matchesText(r.noi_luu_giu_hien_nay, query.currentRepository))
        return false;
    }

    return true;
  });

  const sortMode = query.sort || 'newest';
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'title_asc') {
      return (a.title || '').localeCompare(b.title || '', 'vi');
    }
    if (sortMode === 'identifier_asc') {
      return (a.identifier || '').localeCompare(b.identifier || '', 'vi');
    }
    if (sortMode === 'verified_first') {
      const rank = (s: VerificationLevel | string | undefined) =>
        s === 'da_kiem_chung' ? 0 : s === 'chua_kiem_chung' ? 1 : 2;
      const diff = rank(a.muc_kiem_chung) - rank(b.muc_kiem_chung);
      if (diff !== 0) return diff;
    }
    return (b.ngay_cap_nhat || b.ngay_tiep_nhan || '').localeCompare(
      a.ngay_cap_nhat || a.ngay_tiep_nhan || ''
    );
  });

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
  const start = (page - 1) * limit;
  const paged = sorted.slice(start, start + limit).map(sanitizeRecordForPublic);

  return {
    items: paged,
    total: sorted.length,
    facets: {
      huyenLichSu: Array.from(huyenSet).sort(),
      xaHienNay: Array.from(xaHienNaySet).sort(),
      xaLichSu: Array.from(xaLichSuSet).sort(),
      thonLang: Array.from(thonLangSet).sort(),
      repositories: Array.from(repoSet).sort(),
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

function generateTrackingCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TN-${y}${m}${d}-${rand}`;
}

export async function saveSubmission(
  input: CitizenSubmissionInput,
  pendingImages: PendingImageItem[]
): Promise<{
  id: string;
  ngay_gui: string;
  trang_thai_xu_ly: ProcessingStatus;
}> {
  const submissions = await readSubmissions();
  const nowIso = new Date().toISOString();
  const submissionId = generateTrackingCode();

  const entry: SubmissionRecord = {
    submission_id: submissionId,
    ngay_gui: nowIso,
    ngay_cap_nhat: nowIso,
    trang_thai_xu_ly: 'PENDING',
    loai_dong_gop:
      input.loai_dong_gop === 'bo_sung_chinh_sua'
        ? 'bo_sung_chinh_sua'
        : 'ho_so_moi',
    target_identifier: input.target_identifier || undefined,
    ten_tu_lieu: input.ten_tu_lieu,
    ten_goi_khac: '',
    loai_tu_lieu: input.loai_tu_lieu || 'Hoành phi',
    creator: '',
    subject: input.loai_tu_lieu ? [input.loai_tu_lieu] : [],
    description: input.ghi_chu || '',
    publisher: 'Hồ sơ số Hoành phi – Câu đối Hà Nội',
    format: '',
    language: 'Chữ Hán/Nôm, Tiếng Việt',
    relation: [],
    rights: input.pham_vi_su_dung || '',
    noi_luu_giu: input.noi_luu_giu,
    noi_luu_giu_tai_thoi_diem_tu_lieu: input.noi_luu_giu,
    loai_dia_diem: input.loai_dia_diem || 'Khác',
    ten_di_tich: '',
    nha_tho_ho: '',
    dia_danh_hien_nay: input.dia_danh_hien_nay || '',
    phuong_xa_hien_nay: '',
    dia_danh_lich_su: input.dia_danh_lich_su || '',
    phuong_xa_lich_su: '',
    thon_lang: input.thon_lang || '',
    dong_ho_hoac_gia_dinh: input.dong_ho_hoac_gia_dinh || '',
    gia_dinh_lien_quan: '',
    loai_ban_dang_hien_thi:
      pendingImages.length > 0 ? 'Ảnh bản gốc' : 'Bản phiên âm',
    tinh_trang_ban_goc: 'Không xác định',
    so_dang_ky: submissionId,
    chu_han_nom: input.chu_han_nom || '',
    phien_am_de_xuat: input.phien_am_de_xuat || '',
    dich_nghia_de_xuat: input.dich_nghia_de_xuat || '',
    giai_thich_noi_dung: '',
    nien_dai_de_xuat: input.nien_dai_de_xuat || '',
    nguoi_cung_cap: input.nguoi_cung_cap,
    cong_khai_nguoi_cung_cap: false,
    lien_he: input.lien_he || '',
    nguon_xac_minh: input.nguon_xac_minh,
    nguon_anh: input.nguon_anh || '',
    nguoi_cho_phep_cong_bo: input.nguoi_cho_phep_cong_bo || '',
    pham_vi_su_dung: input.pham_vi_su_dung || '',
    phan_khong_cong_bo: '',
    xac_nhan_quyen_cong_bo: Boolean(input.xac_nhan_quyen_cong_bo),
    ghi_chu: input.ghi_chu || '',
    muc_kiem_chung: 'chua_kiem_chung',
    kiem_chung_chi_tiet: normalizeGranularVerification(),
    pending_images: pendingImages,
    lich_su_duyet: [],
  };

  submissions.unshift(entry);
  await writeSubmissions(submissions);

  return {
    id: entry.submission_id,
    ngay_gui: entry.ngay_gui,
    trang_thai_xu_ly: entry.trang_thai_xu_ly,
  };
}

export async function promoteSubmissionToOfficialRecord(
  submission: SubmissionRecord,
  reviewerName: string,
  overallVerification: VerificationLevel,
  granular: GranularVerification
): Promise<string> {
  const dataset = await readDataset();
  const todayStr = new Date().toISOString().slice(0, 10);

  let targetIdx = -1;
  let identifier = submission.official_identifier || '';

  if (submission.target_identifier) {
    targetIdx = dataset.records.findIndex(
      (r) => r.identifier === submission.target_identifier
    );
    if (targetIdx >= 0) {
      identifier = dataset.records[targetIdx].identifier;
    }
  }

  if (!identifier) {
    identifier = `HN-${submission.submission_id.replace(/^TN-/, '')}`;
  }
  if (targetIdx < 0) {
    targetIdx = dataset.records.findIndex((r) => r.identifier === identifier);
  }

  // Move/copy pending images into private official storage/images/
  // Image permission stays 'cho_xac_nhan' unless reviewer/admin explicitly approved & authority is complete
  const promotedImages: ArchiveImageRaw[] =
    targetIdx >= 0 && Array.isArray(dataset.records[targetIdx].images)
      ? [...dataset.records[targetIdx].images]
      : [];

  await fs.mkdir(path.join(serverConfig.imagesDir, 'originals'), {
    recursive: true,
  });
  await fs.mkdir(path.join(serverConfig.imagesDir, 'thumbnails'), {
    recursive: true,
  });

  const normalizedScope = normalizeVietnamese(submission.pham_vi_su_dung);
  const baseAuthorityValid =
    Boolean(submission.nguoi_cho_phep_cong_bo?.trim()) &&
    Boolean(submission.pham_vi_su_dung?.trim()) &&
    normalizedScope !== 'khong cong bo' &&
    normalizedScope !== 'khong_cong_bo' &&
    normalizedScope !== 'noi bo' &&
    submission.xac_nhan_quyen_cong_bo === true;

  for (const pImg of submission.pending_images) {
    if (promotedImages.some((existing) => existing.image_id === pImg.image_id)) {
      const existing = promotedImages.find((e) => e.image_id === pImg.image_id)!;
      existing.caption = pImg.caption;
      existing.source = pImg.source;
      existing.image_type = pImg.image_type;
      existing.permission =
        baseAuthorityValid && pImg.permission === 'duoc_phep_cong_bo'
          ? 'duoc_phep_cong_bo'
          : pImg.permission === 'khong_cong_bo'
            ? 'khong_cong_bo'
            : 'cho_xac_nhan';
      continue;
    }

    const srcFile = path.resolve(
      serverConfig.pendingImagesDir,
      path.basename(pImg.filename)
    );
    const destOrigRel = `originals/${path.basename(pImg.filename)}`;
    const destThumbRel = `thumbnails/${path.basename(pImg.filename)}`;

    try {
      await fs.copyFile(
        srcFile,
        path.resolve(serverConfig.imagesDir, destOrigRel)
      );
      await createReducedDisplayImage(
        srcFile,
        path.resolve(serverConfig.imagesDir, destThumbRel)
      );
    } catch {
      continue;
    }

    promotedImages.push({
      image_id: pImg.image_id,
      file: destOrigRel,
      thumbnail: destThumbRel,
      image_type: pImg.image_type || 'toan_trang',
      caption: pImg.caption || submission.ten_tu_lieu,
      source: pImg.source || submission.nguon_anh || submission.nguon_xac_minh,
      permission:
        baseAuthorityValid && pImg.permission === 'duoc_phep_cong_bo'
          ? 'duoc_phep_cong_bo'
          : pImg.permission === 'khong_cong_bo'
            ? 'khong_cong_bo'
            : 'cho_xac_nhan',
    });
  }

  const existingRecord = targetIdx >= 0 ? dataset.records[targetIdx] : undefined;

  const updatedRecord: ArchiveRecordRaw = {
    identifier,
    title: submission.ten_tu_lieu,
    ten_goi_khac: submission.ten_goi_khac || existingRecord?.ten_goi_khac || '',
    creator: submission.creator || existingRecord?.creator || '',
    subject:
      Array.isArray(submission.subject) && submission.subject.length > 0
        ? submission.subject
        : existingRecord?.subject || [submission.loai_tu_lieu],
    description:
      submission.description ||
      existingRecord?.description ||
      submission.ghi_chu ||
      '',
    publisher:
      submission.publisher ||
      existingRecord?.publisher ||
      'Hồ sơ số Hoành phi – Câu đối Hà Nội',
    contributor: submission.cong_khai_nguoi_cung_cap
      ? [submission.nguoi_cung_cap]
      : existingRecord?.contributor || [],
    date: submission.nien_dai_de_xuat || existingRecord?.date || '',
    type: submission.loai_tu_lieu || existingRecord?.type || '',
    format: submission.format || existingRecord?.format || '',
    source: submission.nguon_xac_minh
      ? [submission.nguon_xac_minh]
      : existingRecord?.source || [],
    language:
      submission.language ||
      existingRecord?.language ||
      'Chữ Hán/Nôm, Tiếng Việt',
    relation:
      Array.isArray(submission.relation) && submission.relation.length > 0
        ? submission.relation
        : existingRecord?.relation || [],
    coverage: {
      thanh_pho: existingRecord?.coverage?.thanh_pho || 'Hà Nội',
      don_vi_hanh_chinh_hien_nay:
        submission.dia_danh_hien_nay ||
        existingRecord?.coverage?.don_vi_hanh_chinh_hien_nay ||
        '',
      don_vi_hanh_chinh_lich_su:
        submission.dia_danh_lich_su ||
        existingRecord?.coverage?.don_vi_hanh_chinh_lich_su ||
        '',
      phuong_xa_hien_nay:
        submission.phuong_xa_hien_nay ||
        existingRecord?.coverage?.phuong_xa_hien_nay ||
        '',
      phuong_xa_lich_su:
        submission.phuong_xa_lich_su ||
        existingRecord?.coverage?.phuong_xa_lich_su ||
        '',
      thon_lang:
        submission.thon_lang || existingRecord?.coverage?.thon_lang || '',
      thoi_gian:
        submission.nien_dai_de_xuat || existingRecord?.coverage?.thoi_gian || '',
    },
    rights:
      submission.rights ||
      submission.pham_vi_su_dung ||
      existingRecord?.rights ||
      '',
    noi_luu_giu_hien_nay: submission.noi_luu_giu,
    noi_luu_giu_tai_thoi_diem_tu_lieu:
      submission.noi_luu_giu_tai_thoi_diem_tu_lieu ||
      existingRecord?.noi_luu_giu_tai_thoi_diem_tu_lieu ||
      submission.noi_luu_giu,
    loai_ban_dang_hien_thi:
      submission.loai_ban_dang_hien_thi ||
      existingRecord?.loai_ban_dang_hien_thi ||
      (promotedImages.length > 0 ? 'Ảnh bản gốc' : 'Bản phiên âm'),
    tinh_trang_ban_goc:
      submission.tinh_trang_ban_goc ||
      existingRecord?.tinh_trang_ban_goc ||
      'Không xác định',
    so_dang_ky:
      submission.so_dang_ky ||
      existingRecord?.so_dang_ky ||
      submission.submission_id,
    nguoi_cho_phep_cong_bo: submission.nguoi_cho_phep_cong_bo || '',
    pham_vi_duoc_phep: submission.pham_vi_su_dung || '',
    phan_khong_cong_bo:
      submission.phan_khong_cong_bo || existingRecord?.phan_khong_cong_bo || '',
    muc_kiem_chung: overallVerification,
    trang_thai_xu_ly: submission.trang_thai_xu_ly,
    kiem_chung_chi_tiet: granular,
    images: promotedImages,
    chu_han_nom: submission.chu_han_nom || '',
    phien_am: {
      noi_dung: submission.phien_am_de_xuat || '',
      trang_thai: granular.phien_am,
    },
    dich_nghia: {
      noi_dung: submission.dich_nghia_de_xuat || '',
      trang_thai: granular.dich_nghia,
    },
    giai_thich_noi_dung: submission.giai_thich_noi_dung
      ? {
          noi_dung: submission.giai_thich_noi_dung,
          trang_thai: overallVerification,
        }
      : existingRecord?.giai_thich_noi_dung,
    ghi_chu:
      submission.ghi_chu_kiem_duyet ||
      submission.ghi_chu ||
      existingRecord?.ghi_chu ||
      '',
    ngay_cap_nhat: todayStr,
    loai_dia_diem_luu_giu: submission.loai_dia_diem,
    ten_di_tich: submission.ten_di_tich || existingRecord?.ten_di_tich || '',
    nha_tho_ho: submission.nha_tho_ho || existingRecord?.nha_tho_ho || '',
    dong_ho_lien_quan: submission.dong_ho_hoac_gia_dinh,
    gia_dinh_lien_quan:
      submission.gia_dinh_lien_quan || existingRecord?.gia_dinh_lien_quan || '',
    ngay_tiep_nhan: submission.ngay_gui.slice(0, 10),
    cong_khai_nguoi_cung_cap: Boolean(submission.cong_khai_nguoi_cung_cap),
    lich_su_chinh_sua: [
      ...(existingRecord?.lich_su_chinh_sua || []),
      {
        ngay: todayStr,
        noi_dung: `Cập nhật từ hồ sơ tiếp nhận ${submission.submission_id} (${submission.trang_thai_xu_ly})`,
        nguoi_thuc_hien: reviewerName,
      },
    ],
  };

  // Ensure record image authority check stays consistent
  if (!hasRecordPublicationAuthority(updatedRecord)) {
    updatedRecord.images = updatedRecord.images.map((im) => ({
      ...im,
      permission:
        im.permission === 'khong_cong_bo' ? 'khong_cong_bo' : 'cho_xac_nhan',
    }));
  }

  if (targetIdx >= 0) {
    dataset.records[targetIdx] = updatedRecord;
  } else {
    dataset.records.unshift(updatedRecord);
  }

  await writeDataset(dataset);
  return identifier;
}
