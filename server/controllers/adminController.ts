import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Response } from 'express';
import { serverConfig } from '../config/env.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import type {
  ArchiveImageRaw,
  ArchiveRecordRaw,
  ArchiveSource,
  GranularVerification,
  ImageType,
  ProcessingStatus,
  VerificationLevel,
} from '../../src/types/archive.ts';
import { appendAuditLog, listAuditLogs } from '../services/auditService.ts';
import {
  createUserAccount,
  listAllUsers,
  updateUserAccount,
} from '../services/authService.ts';
import {
  createReducedDisplayImage,
  promoteSubmissionToOfficialRecord,
  readDataset,
  readSubmissions,
  writeDataset,
  writeSubmissions,
} from '../services/dataService.ts';
import { previewBulkImport } from '../services/importService.ts';
import {
  hasRecordPublicationAuthority,
  normalizeGranularVerification,
  normalizeVerification,
} from '../utils/archiveSanitizer.ts';

const VALID_PROCESSING_STATUSES: ProcessingStatus[] = [
  'PENDING',
  'CHO_XAC_NHAN',
  'DANG_KIEM_TRA',
  'CAN_BO_SUNG',
  'DA_XAC_NHAN',
  'TU_CHOI',
  'CHO_CONG_KHAI',
  'DA_CONG_KHAI',
];

export async function getAdminOverview(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [submissions, dataset] = await Promise.all([
      readSubmissions(),
      readDataset(),
    ]);

    const statusCounts: Record<ProcessingStatus, number> = {
      PENDING: 0,
      CHO_XAC_NHAN: 0,
      DANG_KIEM_TRA: 0,
      CAN_BO_SUNG: 0,
      DA_XAC_NHAN: 0,
      TU_CHOI: 0,
      CHO_CONG_KHAI: 0,
      DA_CONG_KHAI: 0,
    };

    for (const s of submissions) {
      if (s.trang_thai_xu_ly in statusCounts) {
        statusCounts[s.trang_thai_xu_ly] += 1;
      }
    }

    res.json({
      statusCounts,
      totalSubmissions: submissions.length,
      totalOfficialRecords: dataset.records.length,
      totalPublishedRecords: dataset.records.filter(
        (r) => !r.trang_thai_xu_ly || r.trang_thai_xu_ly === 'DA_CONG_KHAI'
      ).length,
      totalSources: dataset.sources.length,
    });
  } catch {
    res.status(500).json({ error: 'Không thể tải tổng quan quản trị.' });
  }
}

export async function listAdminSubmissions(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';
    let submissions = await readSubmissions();
    if (statusFilter) {
      const allowed = statusFilter.split(',').map((s) => s.trim());
      submissions = submissions.filter((s) =>
        allowed.includes(s.trang_thai_xu_ly)
      );
    }
    res.json({ submissions });
  } catch {
    res
      .status(500)
      .json({ error: 'Không thể tải danh sách hồ sơ chờ xác nhận.' });
  }
}

export async function getAdminSubmissionDetail(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = req.params.id;
    const submissions = await readSubmissions();
    const found = submissions.find((s) => s.submission_id === id);
    if (!found) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tiếp nhận.' });
      return;
    }
    res.json({ submission: found });
  } catch {
    res.status(500).json({ error: 'Không thể tải chi tiết hồ sơ tiếp nhận.' });
  }
}

export async function getPendingImageFile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id, imageId } = req.params;
    const submissions = await readSubmissions();
    const found = submissions.find((s) => s.submission_id === id);
    if (!found) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tiếp nhận.' });
      return;
    }
    const img = (found.pending_images || []).find(
      (item) => item.image_id === imageId
    );
    if (!img) {
      res.status(404).json({ error: 'Không tìm thấy ảnh chờ duyệt.' });
      return;
    }
    const safePath = path.resolve(
      serverConfig.pendingImagesDir,
      path.basename(img.filename)
    );
    if (!safePath.startsWith(serverConfig.pendingImagesDir + path.sep)) {
      res.status(403).json({ error: 'Đường dẫn ảnh không hợp lệ.' });
      return;
    }
    await fs.access(safePath);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(safePath);
  } catch {
    res.status(404).json({ error: 'Không tìm thấy tệp ảnh chờ duyệt.' });
  }
}

export async function updateAdminSubmission(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const id = req.params.id;
    const submissions = await readSubmissions();
    const idx = submissions.findIndex((s) => s.submission_id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tiếp nhận.' });
      return;
    }

    const current = submissions[idx];
    const beforeSnapshot = {
      trang_thai_xu_ly: current.trang_thai_xu_ly,
      ten_tu_lieu: current.ten_tu_lieu,
      noi_luu_giu: current.noi_luu_giu,
      chu_han_nom: current.chu_han_nom,
      phien_am_de_xuat: current.phien_am_de_xuat,
      dich_nghia_de_xuat: current.dich_nghia_de_xuat,
      kiem_chung_chi_tiet: current.kiem_chung_chi_tiet,
    };

    const body = req.body as Record<string, unknown>;
    const action =
      typeof body.action === 'string' ? body.action : 'LUU_BAN_NHAP';
    const reason = typeof body.ly_do === 'string' ? body.ly_do.trim() : '';

    let nextStatus: ProcessingStatus = current.trang_thai_xu_ly;

    if (action === 'MO_KIEM_TRA') {
      nextStatus = 'DANG_KIEM_TRA';
    } else if (action === 'LUU_BAN_NHAP') {
      if (
        typeof body.trang_thai_xu_ly === 'string' &&
        VALID_PROCESSING_STATUSES.includes(
          body.trang_thai_xu_ly as ProcessingStatus
        )
      ) {
        nextStatus = body.trang_thai_xu_ly as ProcessingStatus;
      }
    } else if (action === 'YEU_CAU_BO_SUNG') {
      if (!reason) {
        res.status(400).json({
          error: 'Bắt buộc nhập lý do khi yêu cầu người gửi bổ sung thông tin.',
        });
        return;
      }
      nextStatus = 'CAN_BO_SUNG';
    } else if (action === 'TU_CHOI') {
      if (!reason) {
        res.status(400).json({
          error: 'Bắt buộc nhập lý do khi từ chối hồ sơ tư liệu.',
        });
        return;
      }
      nextStatus = 'TU_CHOI';
    } else if (action === 'DUYET_VA_CONG_KHAI') {
      if (!actor.can_publish) {
        res.status(403).json({
          error:
            'Tài khoản kiểm duyệt viên chưa được cấp quyền công khai hồ sơ trực tiếp.',
        });
        return;
      }
      nextStatus = 'DA_CONG_KHAI';
    } else if (action === 'XAC_NHAN_THONG_TIN') {
      const requestedStatus =
        typeof body.target_status === 'string'
          ? (body.target_status as ProcessingStatus)
          : 'DA_XAC_NHAN';
      if (
        !['DA_XAC_NHAN', 'CHO_CONG_KHAI', 'DA_CONG_KHAI'].includes(
          requestedStatus
        )
      ) {
        res.status(400).json({ error: 'Trạng thái phê duyệt không hợp lệ.' });
        return;
      }
      if (requestedStatus === 'DA_CONG_KHAI' && !actor.can_publish) {
        res.status(403).json({
          error:
            'Tài khoản kiểm duyệt viên chưa được cấp quyền công khai hồ sơ. Vui lòng chọn "Chờ công khai" (CHO_CONG_KHAI).',
        });
        return;
      }
      nextStatus = requestedStatus;
    }

    if (nextStatus === 'DA_CONG_KHAI' && !actor.can_publish) {
      res.status(403).json({
        error: 'Tài khoản không có quyền chuyển trạng thái sang Đã công khai.',
      });
      return;
    }

    const strField = (key: string, fallback: string) =>
      typeof body[key] === 'string' ? (body[key] as string).trim() : fallback;

    const updatedGranular: GranularVerification = normalizeGranularVerification(
      (body.kiem_chung_chi_tiet as Partial<GranularVerification>) ||
        current.kiem_chung_chi_tiet
    );

    const requestedOverall: VerificationLevel = normalizeVerification(
      typeof body.muc_kiem_chung === 'string'
        ? body.muc_kiem_chung
        : current.muc_kiem_chung || 'chua_kiem_chung'
    );

    const nextAuthorizer = strField(
      'nguoi_cho_phep_cong_bo',
      current.nguoi_cho_phep_cong_bo
    );
    const nextScope = strField('pham_vi_su_dung', current.pham_vi_su_dung);
    const nextConfirmedRights =
      typeof body.xac_nhan_quyen_cong_bo === 'boolean'
        ? body.xac_nhan_quyen_cong_bo
        : current.xac_nhan_quyen_cong_bo;

    const authorityComplete =
      Boolean(nextAuthorizer) &&
      Boolean(nextScope) &&
      nextScope.toLowerCase() !== 'không công bố' &&
      nextScope.toLowerCase() !== 'khong cong bo' &&
      nextConfirmedRights === true;

    const validPendingImageTypes: ImageType[] = [
      'toan_trang',
      'can_canh',
      'can_canh_trai',
      'can_canh_phai',
      'can_canh_chu',
      'ban_dap',
      'ban_sao',
      'khac',
    ];

    const updatedPendingImages = Array.isArray(body.pending_images)
      ? current.pending_images.map((img) => {
          const patch = (
            body.pending_images as Array<Record<string, unknown>>
          ).find((p) => p.image_id === img.image_id);
          if (!patch) return img;
          const requestedPerm =
            patch.permission === 'duoc_phep_cong_bo' ||
            patch.permission === 'khong_cong_bo' ||
            patch.permission === 'cho_xac_nhan'
              ? patch.permission
              : img.permission;
          const nextPerm =
            requestedPerm === 'duoc_phep_cong_bo' && !authorityComplete
              ? 'cho_xac_nhan'
              : requestedPerm;
          const nextImgType =
            typeof patch.image_type === 'string' &&
            validPendingImageTypes.includes(patch.image_type as ImageType)
              ? (patch.image_type as ImageType)
              : img.image_type;
          return {
            ...img,
            image_type: nextImgType,
            caption:
              typeof patch.caption === 'string'
                ? patch.caption.trim()
                : img.caption,
            source:
              typeof patch.source === 'string'
                ? patch.source.trim()
                : img.source,
            nguoi_cho_phep_cong_bo: nextAuthorizer,
            pham_vi_duoc_phep: nextScope,
            permission: nextPerm,
          };
        })
      : current.pending_images;

    const nowIso = new Date().toISOString();
    const historyEntry = {
      nguoi_duyet: actor.full_name,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      thoi_gian: nowIso,
      trang_thai_truoc: current.trang_thai_xu_ly,
      trang_thai_sau: nextStatus,
      hanh_dong: action,
      ly_do: reason || `Thực hiện thao tác ${action}`,
    };

    const updated = {
      ...current,
      ten_tu_lieu: strField('ten_tu_lieu', current.ten_tu_lieu),
      ten_goi_khac: strField('ten_goi_khac', current.ten_goi_khac || ''),
      loai_tu_lieu: strField('loai_tu_lieu', current.loai_tu_lieu),
      creator: strField('creator', current.creator || ''),
      subject:
        body.subject !== undefined
          ? toStringArray(body.subject, current.subject || [])
          : current.subject || [],
      description: strField('description', current.description || ''),
      publisher: strField(
        'publisher',
        current.publisher || 'Hồ sơ số Hoành phi – Câu đối Hà Nội'
      ),
      format: strField('format', current.format || ''),
      language: strField(
        'language',
        current.language || 'Chữ Hán/Nôm, Tiếng Việt'
      ),
      relation:
        body.relation !== undefined
          ? toStringArray(body.relation, current.relation || [])
          : current.relation || [],
      rights: strField('rights', current.rights || ''),
      noi_luu_giu: strField('noi_luu_giu', current.noi_luu_giu),
      noi_luu_giu_tai_thoi_diem_tu_lieu: strField(
        'noi_luu_giu_tai_thoi_diem_tu_lieu',
        current.noi_luu_giu_tai_thoi_diem_tu_lieu || current.noi_luu_giu
      ),
      loai_dia_diem: strField('loai_dia_diem', current.loai_dia_diem),
      ten_di_tich: strField('ten_di_tich', current.ten_di_tich || ''),
      nha_tho_ho: strField('nha_tho_ho', current.nha_tho_ho || ''),
      dia_danh_hien_nay: strField(
        'dia_danh_hien_nay',
        current.dia_danh_hien_nay
      ),
      phuong_xa_hien_nay: strField(
        'phuong_xa_hien_nay',
        current.phuong_xa_hien_nay || ''
      ),
      dia_danh_lich_su: strField('dia_danh_lich_su', current.dia_danh_lich_su),
      phuong_xa_lich_su: strField(
        'phuong_xa_lich_su',
        current.phuong_xa_lich_su || ''
      ),
      thon_lang: strField('thon_lang', current.thon_lang),
      dong_ho_hoac_gia_dinh: strField(
        'dong_ho_hoac_gia_dinh',
        current.dong_ho_hoac_gia_dinh
      ),
      gia_dinh_lien_quan: strField(
        'gia_dinh_lien_quan',
        current.gia_dinh_lien_quan || ''
      ),
      loai_ban_dang_hien_thi: strField(
        'loai_ban_dang_hien_thi',
        current.loai_ban_dang_hien_thi || ''
      ),
      tinh_trang_ban_goc: strField(
        'tinh_trang_ban_goc',
        current.tinh_trang_ban_goc || 'Không xác định'
      ),
      so_dang_ky: strField('so_dang_ky', current.so_dang_ky || ''),
      chu_han_nom: strField('chu_han_nom', current.chu_han_nom),
      phien_am_de_xuat: strField('phien_am_de_xuat', current.phien_am_de_xuat),
      dich_nghia_de_xuat: strField(
        'dich_nghia_de_xuat',
        current.dich_nghia_de_xuat
      ),
      giai_thich_noi_dung: strField(
        'giai_thich_noi_dung',
        current.giai_thich_noi_dung || ''
      ),
      nien_dai_de_xuat: strField('nien_dai_de_xuat', current.nien_dai_de_xuat),
      nguon_xac_minh: strField('nguon_xac_minh', current.nguon_xac_minh),
      nguon_anh: strField('nguon_anh', current.nguon_anh),
      nguoi_cho_phep_cong_bo: nextAuthorizer,
      pham_vi_su_dung: nextScope,
      phan_khong_cong_bo: strField(
        'phan_khong_cong_bo',
        current.phan_khong_cong_bo || ''
      ),
      xac_nhan_quyen_cong_bo: nextConfirmedRights,
      cong_khai_nguoi_cung_cap:
        typeof body.cong_khai_nguoi_cung_cap === 'boolean'
          ? body.cong_khai_nguoi_cung_cap
          : current.cong_khai_nguoi_cung_cap,
      ghi_chu_kiem_duyet: strField(
        'ghi_chu_kiem_duyet',
        current.ghi_chu_kiem_duyet || ''
      ),
      ly_do_xu_ly: reason || current.ly_do_xu_ly || '',
      nguoi_xu_ly: actor.username,
      ngay_cap_nhat: nowIso,
      trang_thai_xu_ly: nextStatus,
      muc_kiem_chung: requestedOverall,
      kiem_chung_chi_tiet: updatedGranular,
      pending_images: updatedPendingImages,
      lich_su_duyet: [...(current.lich_su_duyet || []), historyEntry],
    };

    if (
      nextStatus === 'DA_XAC_NHAN' ||
      nextStatus === 'CHO_CONG_KHAI' ||
      nextStatus === 'DA_CONG_KHAI'
    ) {
      const officialId = await promoteSubmissionToOfficialRecord(
        updated,
        actor.full_name,
        requestedOverall,
        updatedGranular
      );
      updated.official_identifier = officialId;
    } else if (
      (nextStatus === 'TU_CHOI' || nextStatus === 'CAN_BO_SUNG') &&
      updated.official_identifier
    ) {
      // Ensure rejected or revision-needed records do not appear in public listings
      const dataset = await readDataset();
      const recIdx = dataset.records.findIndex(
        (r) => r.identifier === updated.official_identifier
      );
      if (recIdx >= 0) {
        dataset.records[recIdx].trang_thai_xu_ly = nextStatus;
        await writeDataset(dataset);
      }
    }

    submissions[idx] = updated;
    await writeSubmissions(submissions);

    await appendAuditLog({
      ma_ho_so: updated.official_identifier || updated.submission_id,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: action,
      noi_dung_truoc: beforeSnapshot,
      noi_dung_sau: {
        trang_thai_xu_ly: updated.trang_thai_xu_ly,
        ten_tu_lieu: updated.ten_tu_lieu,
        noi_luu_giu: updated.noi_luu_giu,
        chu_han_nom: updated.chu_han_nom,
        phien_am_de_xuat: updated.phien_am_de_xuat,
        dich_nghia_de_xuat: updated.dich_nghia_de_xuat,
        muc_kiem_chung: updated.muc_kiem_chung,
        kiem_chung_chi_tiet: updated.kiem_chung_chi_tiet,
      },
      ly_do: reason || `Thực hiện thao tác ${action}`,
    });

    res.json({ ok: true, submission: updated });
  } catch (err) {
    console.error('Lỗi cập nhật hồ sơ kiểm duyệt:', err);
    res.status(500).json({ error: 'Không thể cập nhật hồ sơ kiểm duyệt.' });
  }
}

export async function listOfficialRecordsAdmin(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const dataset = await readDataset();
    res.json({ records: dataset.records });
  } catch {
    res
      .status(500)
      .json({ error: 'Không thể tải danh sách hồ sơ chính thức.' });
  }
}

function toStringArray(val: unknown, fallback: string[]): string[] {
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return fallback;
}

export async function createOfficialRecordAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const body = req.body as Record<string, unknown>;
    const todayStr = new Date().toISOString().slice(0, 10);

    const identifier =
      typeof body.identifier === 'string' && body.identifier.trim()
        ? body.identifier.trim()
        : `HN-${todayStr.replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const currentRepo =
      typeof body.noi_luu_giu_hien_nay === 'string'
        ? body.noi_luu_giu_hien_nay.trim()
        : '';

    if (!title || !currentRepo) {
      res.status(400).json({
        error: 'Vui lòng nhập đầy đủ Tên tư liệu và Nơi lưu giữ hiện nay.',
      });
      return;
    }

    const dataset = await readDataset();
    if (dataset.records.some((r) => r.identifier === identifier)) {
      res.status(409).json({
        error: `Mã định danh "${identifier}" đã tồn tại trong cơ sở dữ liệu.`,
      });
      return;
    }

    const requestedStatus =
      typeof body.trang_thai_xu_ly === 'string' &&
      VALID_PROCESSING_STATUSES.includes(
        body.trang_thai_xu_ly as ProcessingStatus
      )
        ? (body.trang_thai_xu_ly as ProcessingStatus)
        : actor.can_publish
          ? 'DA_CONG_KHAI'
          : 'CHO_CONG_KHAI';

    if (requestedStatus === 'DA_CONG_KHAI' && !actor.can_publish) {
      res.status(403).json({
        error: 'Tài khoản của bạn chưa được cấp quyền công khai hồ sơ.',
      });
      return;
    }

    const s = (k: string, def = '') =>
      typeof body[k] === 'string' ? (body[k] as string).trim() : def;
    const cov = (body.coverage as Record<string, unknown>) || {};
    const cs = (k: string, def = '') =>
      typeof cov[k] === 'string' ? (cov[k] as string).trim() : def;

    const granular = normalizeGranularVerification(
      body.kiem_chung_chi_tiet as Partial<GranularVerification>
    );
    const mucKiemChung = normalizeVerification(s('muc_kiem_chung'));

    const record: ArchiveRecordRaw = {
      identifier,
      title,
      ten_goi_khac: s('ten_goi_khac'),
      creator: s('creator'),
      subject: toStringArray(body.subject, []),
      description: s('description'),
      publisher: s('publisher', 'Hồ sơ số Hoành phi – Câu đối Hà Nội'),
      contributor: toStringArray(body.contributor, []),
      date: s('date'),
      type: s('type', 'Hoành phi'),
      format: s('format'),
      source: toStringArray(body.source, []),
      language: s('language', 'Chữ Hán/Nôm, Tiếng Việt'),
      relation: toStringArray(body.relation, []),
      coverage: {
        thanh_pho: cs('thanh_pho', 'Hà Nội'),
        don_vi_hanh_chinh_hien_nay: cs('don_vi_hanh_chinh_hien_nay'),
        don_vi_hanh_chinh_lich_su: cs('don_vi_hanh_chinh_lich_su'),
        phuong_xa_hien_nay: cs('phuong_xa_hien_nay'),
        phuong_xa_lich_su: cs('phuong_xa_lich_su'),
        thon_lang: cs('thon_lang'),
        thoi_gian: cs('thoi_gian'),
      },
      rights: s('rights'),
      noi_luu_giu_hien_nay: currentRepo,
      noi_luu_giu_tai_thoi_diem_tu_lieu:
        s('noi_luu_giu_tai_thoi_diem_tu_lieu') || currentRepo,
      loai_ban_dang_hien_thi: s('loai_ban_dang_hien_thi', 'Bản phiên âm'),
      tinh_trang_ban_goc: s('tinh_trang_ban_goc', 'Không xác định'),
      so_dang_ky: s('so_dang_ky'),
      nguoi_cho_phep_cong_bo: s('nguoi_cho_phep_cong_bo'),
      pham_vi_duoc_phep: s('pham_vi_duoc_phep'),
      phan_khong_cong_bo: s('phan_khong_cong_bo'),
      muc_kiem_chung: mucKiemChung,
      kiem_chung_chi_tiet: granular,
      trang_thai_xu_ly: requestedStatus,
      images: [],
      chu_han_nom: s('chu_han_nom'),
      phien_am: {
        noi_dung: s('phien_am_noi_dung'),
        trang_thai: granular.phien_am,
      },
      dich_nghia: {
        noi_dung: s('dich_nghia_noi_dung'),
        trang_thai: granular.dich_nghia,
      },
      giai_thich_noi_dung: s('giai_thich_noi_dung')
        ? {
            noi_dung: s('giai_thich_noi_dung'),
            trang_thai: mucKiemChung,
          }
        : undefined,
      ghi_chu_nghien_cuu: s('ghi_chu_nghien_cuu')
        ? {
            noi_dung: s('ghi_chu_nghien_cuu'),
            trang_thai: mucKiemChung,
          }
        : undefined,
      ghi_chu: s('ghi_chu'),
      ngay_tiep_nhan: todayStr,
      ngay_cap_nhat: todayStr,
      loai_dia_diem_luu_giu: s('loai_dia_diem_luu_giu'),
      ten_di_tich: s('ten_di_tich'),
      dong_ho_lien_quan: s('dong_ho_lien_quan'),
      gia_dinh_lien_quan: s('gia_dinh_lien_quan'),
      nha_tho_ho: s('nha_tho_ho'),
      cong_khai_nguoi_cung_cap: Boolean(body.cong_khai_nguoi_cung_cap),
      lich_su_chinh_sua: [
        {
          ngay: todayStr,
          noi_dung: 'Tạo hồ sơ chính thức trực tiếp trong khu vực quản trị',
          nguoi_thuc_hien: actor.full_name,
        },
      ],
    };

    dataset.records.unshift(record);
    await writeDataset(dataset);

    await appendAuditLog({
      ma_ho_so: record.identifier,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'TAO_HO_SO_CHINH_THUC',
      noi_dung_truoc: {},
      noi_dung_sau: {
        identifier: record.identifier,
        title: record.title,
        trang_thai_xu_ly: record.trang_thai_xu_ly,
        muc_kiem_chung: record.muc_kiem_chung,
      },
      ly_do: s('ly_do') || 'Nhập mới hồ sơ chính thức từ khu vực quản trị',
    });

    res.status(201).json({ ok: true, record });
  } catch {
    res
      .status(500)
      .json({ error: 'Không thể tạo hồ sơ mới trong cơ sở dữ liệu.' });
  }
}

export async function updateOfficialRecordAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const identifier = decodeURIComponent(req.params.identifier || '');
    const dataset = await readDataset();
    const idx = dataset.records.findIndex((r) => r.identifier === identifier);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ trong dữ liệu chính thức.' });
      return;
    }

    const current = dataset.records[idx];
    const body = req.body as Record<string, unknown>;
    const reason = typeof body.ly_do === 'string' ? body.ly_do.trim() : '';

    const nextStatus =
      typeof body.trang_thai_xu_ly === 'string' &&
      VALID_PROCESSING_STATUSES.includes(
        body.trang_thai_xu_ly as ProcessingStatus
      )
        ? (body.trang_thai_xu_ly as ProcessingStatus)
        : current.trang_thai_xu_ly || 'DA_CONG_KHAI';

    if (nextStatus === 'DA_CONG_KHAI' && !actor.can_publish) {
      res.status(403).json({
        error: 'Tài khoản của bạn không có quyền công khai hồ sơ.',
      });
      return;
    }

    const beforeSnapshot = {
      trang_thai_xu_ly: current.trang_thai_xu_ly || 'DA_CONG_KHAI',
      muc_kiem_chung: current.muc_kiem_chung,
      kiem_chung_chi_tiet: current.kiem_chung_chi_tiet,
      nguoi_cho_phep_cong_bo: current.nguoi_cho_phep_cong_bo,
      pham_vi_duoc_phep: current.pham_vi_duoc_phep,
      chu_han_nom: current.chu_han_nom,
      phien_am: current.phien_am,
      dich_nghia: current.dich_nghia,
    };

    const nextGranular = normalizeGranularVerification(
      (body.kiem_chung_chi_tiet as Partial<GranularVerification>) ||
        current.kiem_chung_chi_tiet
    );

    if (typeof body.phien_am_trang_thai === 'string') {
      nextGranular.phien_am = normalizeVerification(body.phien_am_trang_thai);
    }
    if (typeof body.dich_nghia_trang_thai === 'string') {
      nextGranular.dich_nghia = normalizeVerification(
        body.dich_nghia_trang_thai
      );
    }

    const nextMuc = normalizeVerification(
      typeof body.muc_kiem_chung === 'string'
        ? body.muc_kiem_chung
        : current.muc_kiem_chung
    );

    const strOpt = (key: string, fallback = '') =>
      typeof body[key] === 'string' ? (body[key] as string).trim() : fallback;

    const covPatch =
      typeof body.coverage === 'object' && body.coverage !== null
        ? (body.coverage as Record<string, unknown>)
        : undefined;
    const cs = (key: string, fallback: string) =>
      covPatch && typeof covPatch[key] === 'string'
        ? (covPatch[key] as string).trim()
        : fallback;

    const candidateRecord: ArchiveRecordRaw = {
      ...current,
      title: strOpt('title', current.title),
      ten_goi_khac: strOpt('ten_goi_khac', current.ten_goi_khac || ''),
      creator: strOpt('creator', current.creator),
      subject:
        body.subject !== undefined
          ? toStringArray(body.subject, current.subject)
          : current.subject,
      description: strOpt('description', current.description),
      publisher: strOpt('publisher', current.publisher),
      contributor:
        body.contributor !== undefined
          ? toStringArray(body.contributor, current.contributor)
          : current.contributor,
      date: strOpt('date', current.date),
      type: strOpt('type', current.type),
      format: strOpt('format', current.format),
      source:
        body.source !== undefined
          ? toStringArray(body.source, current.source)
          : current.source,
      language: strOpt('language', current.language),
      relation:
        body.relation !== undefined
          ? toStringArray(body.relation, current.relation)
          : current.relation,
      coverage: {
        thanh_pho: cs('thanh_pho', current.coverage?.thanh_pho || 'Hà Nội'),
        don_vi_hanh_chinh_hien_nay: cs(
          'don_vi_hanh_chinh_hien_nay',
          current.coverage?.don_vi_hanh_chinh_hien_nay || ''
        ),
        don_vi_hanh_chinh_lich_su: cs(
          'don_vi_hanh_chinh_lich_su',
          current.coverage?.don_vi_hanh_chinh_lich_su || ''
        ),
        phuong_xa_hien_nay: cs(
          'phuong_xa_hien_nay',
          current.coverage?.phuong_xa_hien_nay || ''
        ),
        phuong_xa_lich_su: cs(
          'phuong_xa_lich_su',
          current.coverage?.phuong_xa_lich_su || ''
        ),
        thon_lang: cs('thon_lang', current.coverage?.thon_lang || ''),
        thoi_gian: cs('thoi_gian', current.coverage?.thoi_gian || ''),
      },
      rights: strOpt('rights', current.rights),
      noi_luu_giu_hien_nay: strOpt(
        'noi_luu_giu_hien_nay',
        current.noi_luu_giu_hien_nay
      ),
      noi_luu_giu_tai_thoi_diem_tu_lieu: strOpt(
        'noi_luu_giu_tai_thoi_diem_tu_lieu',
        current.noi_luu_giu_tai_thoi_diem_tu_lieu
      ),
      loai_ban_dang_hien_thi: strOpt(
        'loai_ban_dang_hien_thi',
        current.loai_ban_dang_hien_thi
      ),
      tinh_trang_ban_goc: strOpt(
        'tinh_trang_ban_goc',
        current.tinh_trang_ban_goc
      ),
      so_dang_ky: strOpt('so_dang_ky', current.so_dang_ky),
      nguoi_cho_phep_cong_bo: strOpt(
        'nguoi_cho_phep_cong_bo',
        current.nguoi_cho_phep_cong_bo
      ),
      pham_vi_duoc_phep: strOpt(
        'pham_vi_duoc_phep',
        current.pham_vi_duoc_phep
      ),
      phan_khong_cong_bo: strOpt(
        'phan_khong_cong_bo',
        current.phan_khong_cong_bo
      ),
      loai_dia_diem_luu_giu: strOpt(
        'loai_dia_diem_luu_giu',
        current.loai_dia_diem_luu_giu || ''
      ),
      ten_di_tich: strOpt('ten_di_tich', current.ten_di_tich || ''),
      dong_ho_lien_quan: strOpt(
        'dong_ho_lien_quan',
        current.dong_ho_lien_quan || ''
      ),
      gia_dinh_lien_quan: strOpt(
        'gia_dinh_lien_quan',
        current.gia_dinh_lien_quan || ''
      ),
      nha_tho_ho: strOpt('nha_tho_ho', current.nha_tho_ho || ''),
      cong_khai_nguoi_cung_cap:
        typeof body.cong_khai_nguoi_cung_cap === 'boolean'
          ? body.cong_khai_nguoi_cung_cap
          : current.cong_khai_nguoi_cung_cap,
      chu_han_nom: strOpt('chu_han_nom', current.chu_han_nom),
      phien_am: {
        noi_dung: strOpt('phien_am_noi_dung', current.phien_am.noi_dung),
        trang_thai: nextGranular.phien_am,
      },
      dich_nghia: {
        noi_dung: strOpt('dich_nghia_noi_dung', current.dich_nghia.noi_dung),
        trang_thai: nextGranular.dich_nghia,
      },
      giai_thich_noi_dung:
        typeof body.giai_thich_noi_dung === 'string'
          ? {
              noi_dung: body.giai_thich_noi_dung.trim(),
              trang_thai: nextMuc,
            }
          : current.giai_thich_noi_dung,
      ghi_chu_nghien_cuu:
        typeof body.ghi_chu_nghien_cuu === 'string'
          ? {
              noi_dung: body.ghi_chu_nghien_cuu.trim(),
              trang_thai: nextMuc,
            }
          : current.ghi_chu_nghien_cuu,
      ghi_chu: strOpt('ghi_chu', current.ghi_chu),
      muc_kiem_chung: nextMuc,
      kiem_chung_chi_tiet: nextGranular,
      trang_thai_xu_ly: nextStatus,
      ngay_cap_nhat: new Date().toISOString().slice(0, 10),
    };

    const validImageTypes: ImageType[] = [
      'toan_trang',
      'can_canh',
      'can_canh_trai',
      'can_canh_phai',
      'can_canh_chu',
      'ban_dap',
      'ban_sao',
      'khac',
    ];

    const authorityOk = hasRecordPublicationAuthority(candidateRecord);

    const nextImages = Array.isArray(body.images)
      ? current.images.map((img) => {
          const patch = (body.images as Array<Record<string, unknown>>).find(
            (p) => p.image_id === img.image_id
          );
          if (!patch) return img;
          const requestedPerm =
            patch.permission === 'duoc_phep_cong_bo' ||
            patch.permission === 'cho_xac_nhan' ||
            patch.permission === 'khong_cong_bo'
              ? patch.permission
              : img.permission;
          const safePerm =
            requestedPerm === 'duoc_phep_cong_bo' && !authorityOk
              ? 'cho_xac_nhan'
              : requestedPerm;
          const nextType =
            typeof patch.image_type === 'string' &&
            validImageTypes.includes(patch.image_type as ImageType)
              ? (patch.image_type as ImageType)
              : img.image_type;
          return {
            ...img,
            permission: safePerm,
            image_type: nextType,
            caption:
              typeof patch.caption === 'string'
                ? patch.caption.trim()
                : img.caption,
            source:
              typeof patch.source === 'string'
                ? patch.source.trim()
                : img.source,
          };
        })
      : current.images;

    const todayStr = new Date().toISOString().slice(0, 10);
    const updated: ArchiveRecordRaw = {
      ...candidateRecord,
      images: nextImages,
      lich_su_chinh_sua: [
        ...(current.lich_su_chinh_sua || []),
        {
          ngay: todayStr,
          noi_dung:
            reason ||
            'Cập nhật thông tin hồ sơ chính thức / kiểm chứng / quyền công bố ảnh',
          nguoi_thuc_hien: actor.full_name,
        },
      ],
    };

    dataset.records[idx] = updated;
    await writeDataset(dataset);

    await appendAuditLog({
      ma_ho_so: updated.identifier,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'CAP_NHAT_HO_SO_CHINH_THUC',
      noi_dung_truoc: beforeSnapshot,
      noi_dung_sau: {
        trang_thai_xu_ly: updated.trang_thai_xu_ly,
        muc_kiem_chung: updated.muc_kiem_chung,
        kiem_chung_chi_tiet: updated.kiem_chung_chi_tiet,
        nguoi_cho_phep_cong_bo: updated.nguoi_cho_phep_cong_bo,
        pham_vi_duoc_phep: updated.pham_vi_duoc_phep,
        phien_am: updated.phien_am,
        dich_nghia: updated.dich_nghia,
      },
      ly_do: reason || 'Cập nhật hồ sơ chính thức / kiểm chứng / quyền công bố ảnh',
    });

    res.json({ ok: true, record: updated });
  } catch {
    res
      .status(500)
      .json({ error: 'Không thể cập nhật hồ sơ trong dữ liệu chính thức.' });
  }
}

export async function deleteOfficialRecordAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const identifier = decodeURIComponent(req.params.identifier || '');
    const dataset = await readDataset();
    const idx = dataset.records.findIndex((r) => r.identifier === identifier);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ cần xóa.' });
      return;
    }

    const removed = dataset.records[idx];
    dataset.records.splice(idx, 1);
    await writeDataset(dataset);

    await appendAuditLog({
      ma_ho_so: removed.identifier,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'XOA_HO_SO_CHINH_THUC',
      noi_dung_truoc: {
        identifier: removed.identifier,
        title: removed.title,
        noi_luu_giu_hien_nay: removed.noi_luu_giu_hien_nay,
        trang_thai_xu_ly: removed.trang_thai_xu_ly,
      },
      noi_dung_sau: {},
      ly_do: 'Quản trị viên xóa hồ sơ khỏi dữ liệu chính thức',
    });

    res.json({ ok: true, deletedIdentifier: removed.identifier });
  } catch {
    res.status(500).json({ error: 'Không thể xóa hồ sơ chính thức.' });
  }
}

export async function uploadOfficialRecordImagesAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const identifier = decodeURIComponent(req.params.identifier || '');
    const dataset = await readDataset();
    const idx = dataset.records.findIndex((r) => r.identifier === identifier);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ chính thức.' });
      return;
    }

    const files = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Vui lòng chọn ít nhất một tệp ảnh.' });
      return;
    }

    const current = dataset.records[idx];
    const body = req.body as Record<string, unknown>;
    const validTypes: ImageType[] = [
      'toan_trang',
      'can_canh',
      'can_canh_trai',
      'can_canh_phai',
      'can_canh_chu',
      'ban_dap',
      'ban_sao',
      'khac',
    ];
    const imageType: ImageType =
      typeof body.image_type === 'string' &&
      validTypes.includes(body.image_type as ImageType)
        ? (body.image_type as ImageType)
        : 'toan_trang';
    const caption =
      typeof body.caption === 'string' ? body.caption.trim() : current.title;
    const source =
      typeof body.source === 'string' && body.source.trim()
        ? body.source.trim()
        : current.source[0] || '';
    const requestedPermission =
      body.permission === 'duoc_phep_cong_bo' ||
      body.permission === 'khong_cong_bo' ||
      body.permission === 'cho_xac_nhan'
        ? body.permission
        : 'cho_xac_nhan';

    const finalPermission =
      requestedPermission === 'duoc_phep_cong_bo' &&
      !hasRecordPublicationAuthority(current)
        ? 'cho_xac_nhan'
        : requestedPermission;

    await fs.mkdir(path.join(serverConfig.imagesDir, 'originals'), {
      recursive: true,
    });
    await fs.mkdir(path.join(serverConfig.imagesDir, 'thumbnails'), {
      recursive: true,
    });

    const added: ArchiveImageRaw[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const baseName = `${identifier.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${i}${path.extname(f.filename) || '.jpg'}`;
      const origRel = `originals/${baseName}`;
      const thumbRel = `thumbnails/${baseName}`;

      await fs.copyFile(
        f.path,
        path.resolve(serverConfig.imagesDir, origRel)
      );
      await createReducedDisplayImage(
        f.path,
        path.resolve(serverConfig.imagesDir, thumbRel)
      );
      // Clean temporary upload file from pending dir
      await fs.unlink(f.path).catch(() => {});

      added.push({
        image_id: `IMG-${Date.now()}-${i}-${crypto.randomBytes(2).toString('hex')}`,
        file: origRel,
        thumbnail: thumbRel,
        image_type: imageType,
        caption: files.length > 1 ? `${caption} (${i + 1})` : caption,
        source,
        permission: finalPermission,
      });
    }

    current.images = [...current.images, ...added];
    current.ngay_cap_nhat = new Date().toISOString().slice(0, 10);
    dataset.records[idx] = current;
    await writeDataset(dataset);

    await appendAuditLog({
      ma_ho_so: current.identifier,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'TAI_ANH_HO_SO_CHINH_THUC',
      noi_dung_truoc: { so_anh: current.images.length - added.length },
      noi_dung_sau: {
        so_anh: current.images.length,
        anh_moi: added.map((a) => ({
          image_id: a.image_id,
          image_type: a.image_type,
          permission: a.permission,
        })),
      },
      ly_do: `Tải lên ${added.length} ảnh cho hồ sơ ${current.identifier}`,
    });

    res.status(201).json({ ok: true, record: current, added });
  } catch {
    res.status(500).json({ error: 'Không thể tải ảnh lên cho hồ sơ.' });
  }
}

export async function deleteOfficialRecordImageAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const identifier = decodeURIComponent(req.params.identifier || '');
    const imageId = decodeURIComponent(req.params.imageId || '');
    const dataset = await readDataset();
    const idx = dataset.records.findIndex((r) => r.identifier === identifier);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ.' });
      return;
    }

    const current = dataset.records[idx];
    const targetImg = current.images.find((im) => im.image_id === imageId);
    if (!targetImg) {
      res.status(404).json({ error: 'Không tìm thấy ảnh cần xóa.' });
      return;
    }

    current.images = current.images.filter((im) => im.image_id !== imageId);
    current.ngay_cap_nhat = new Date().toISOString().slice(0, 10);
    dataset.records[idx] = current;
    await writeDataset(dataset);

    for (const rel of [targetImg.file, targetImg.thumbnail]) {
      if (rel) {
        const resolved = path.resolve(
          serverConfig.imagesDir,
          rel.replace(/^\/+/, '')
        );
        if (resolved.startsWith(serverConfig.imagesDir + path.sep)) {
          await fs.unlink(resolved).catch(() => {});
        }
      }
    }

    await appendAuditLog({
      ma_ho_so: current.identifier,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'XOA_ANH_HO_SO_CHINH_THUC',
      noi_dung_truoc: { image_id: imageId, caption: targetImg.caption },
      noi_dung_sau: { so_anh_con_lai: current.images.length },
      ly_do: `Xóa ảnh ${imageId} khỏi hồ sơ ${current.identifier}`,
    });

    res.json({ ok: true, record: current });
  } catch {
    res.status(500).json({ error: 'Không thể xóa ảnh khỏi hồ sơ.' });
  }
}

export async function previewBulkImportAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const format = req.body?.format === 'csv' ? 'csv' : 'json';
    const content =
      typeof req.body?.content === 'string' ? req.body.content : '';
    if (!content.trim()) {
      res
        .status(400)
        .json({ error: 'Vui lòng cung cấp nội dung tệp JSON hoặc CSV.' });
      return;
    }

    const dataset = await readDataset();
    const preview = previewBulkImport(
      format,
      content,
      dataset.records,
      actor.can_publish
    );
    res.json(preview);
  } catch {
    res
      .status(500)
      .json({ error: 'Không thể kiểm tra cấu trúc dữ liệu nhập.' });
  }
}

export async function commitBulkImportAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const format = req.body?.format === 'csv' ? 'csv' : 'json';
    const content =
      typeof req.body?.content === 'string' ? req.body.content : '';
    if (!content.trim()) {
      res
        .status(400)
        .json({ error: 'Vui lòng cung cấp nội dung tệp JSON hoặc CSV.' });
      return;
    }

    const dataset = await readDataset();
    const preview = previewBulkImport(
      format,
      content,
      dataset.records,
      actor.can_publish
    );

    if (preview.validRecords.length === 0) {
      res.status(400).json({
        error:
          'Không có bản ghi hợp lệ nào để nhập. Vui lòng kiểm tra báo cáo lỗi.',
        preview,
      });
      return;
    }

    dataset.records = [...preview.validRecords, ...dataset.records];
    await writeDataset(dataset);

    await appendAuditLog({
      ma_ho_so: 'NHAP_HANG_LOAT',
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: `NHAP_DU_LIEU_${format.toUpperCase()}`,
      noi_dung_truoc: {
        tong_truoc_khi_nhap: dataset.records.length - preview.validRecords.length,
      },
      noi_dung_sau: {
        so_ban_ghi_da_nhap: preview.validRecords.length,
        so_dong_loi_bo_qua: preview.errors.length,
        danh_sach_ma: preview.validRecords.map((r) => r.identifier),
      },
      ly_do: `Nhập dữ liệu hàng loạt từ ${format.toUpperCase()} (${preview.validRecords.length} bản ghi hợp lệ)`,
    });

    res.status(201).json({
      ok: true,
      importedCount: preview.validRecords.length,
      skippedCount: preview.errors.length,
      errors: preview.errors,
    });
  } catch {
    res.status(500).json({ error: 'Không thể lưu dữ liệu nhập vào hệ thống.' });
  }
}

export async function listAdminSources(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const dataset = await readDataset();
    res.json({ sources: dataset.sources });
  } catch {
    res.status(500).json({ error: 'Không thể tải danh sách nguồn tư liệu.' });
  }
}

export async function upsertAdminSource(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const body = req.body as Partial<ArchiveSource>;
    const maNguon = (body.ma_nguon || '').trim();
    const tenNguon = (body.ten_nguon || '').trim();
    if (!maNguon || !tenNguon) {
      res
        .status(400)
        .json({ error: 'Vui lòng nhập đầy đủ Mã nguồn và Tên nguồn.' });
      return;
    }

    const dataset = await readDataset();
    const idx = dataset.sources.findIndex((s) => s.ma_nguon === maNguon);
    const before = idx >= 0 ? dataset.sources[idx] : {};

    const entry: ArchiveSource = {
      ma_nguon: maNguon,
      ten_nguon: tenNguon,
      loai_nguon: (body.loai_nguon || 'Nguồn khác').trim(),
      tac_gia_hoac_nguoi_cung_cap: (
        body.tac_gia_hoac_nguoi_cung_cap || ''
      ).trim(),
      don_vi_hoac_ca_nhan_luu_giu: (
        body.don_vi_hoac_ca_nhan_luu_giu || ''
      ).trim(),
      cong_khai_nguoi_cung_cap: Boolean(body.cong_khai_nguoi_cung_cap),
      dia_diem: (body.dia_diem || '').trim(),
      ngay_tiep_nhan:
        (body.ngay_tiep_nhan || '').trim() ||
        new Date().toISOString().slice(0, 10),
      nguoi_chup_anh: (body.nguoi_chup_anh || '').trim(),
      nguoi_phien_am: (body.nguoi_phien_am || '').trim(),
      nguoi_kiem_chung: (body.nguoi_kiem_chung || '').trim(),
      tai_lieu_tham_khao: (body.tai_lieu_tham_khao || '').trim(),
      tinh_trang_xac_minh: normalizeVerification(body.tinh_trang_xac_minh),
      ho_so_lien_quan: Array.isArray(body.ho_so_lien_quan)
        ? body.ho_so_lien_quan.map((x) => String(x).trim()).filter(Boolean)
        : [],
      ghi_chu: (body.ghi_chu || '').trim(),
    };

    if (idx >= 0) {
      dataset.sources[idx] = entry;
    } else {
      dataset.sources.unshift(entry);
    }

    await writeDataset(dataset);
    await appendAuditLog({
      ma_ho_so: entry.ma_nguon,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: idx >= 0 ? 'CAP_NHAT_NGUON_TU_LIEU' : 'THEM_NGUON_TU_LIEU',
      noi_dung_truoc: before,
      noi_dung_sau: entry,
      ly_do: 'Quản lý danh mục nguồn tư liệu',
    });

    res.json({ ok: true, source: entry });
  } catch {
    res.status(500).json({ error: 'Không thể lưu thông tin nguồn tư liệu.' });
  }
}

export async function listUsersAdmin(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const users = await listAllUsers();
    res.json({ users });
  } catch {
    res.status(500).json({ error: 'Không thể tải danh sách tài khoản.' });
  }
}

export async function createUserAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const body = req.body as Record<string, unknown>;
    const created = await createUserAccount({
      username: typeof body.username === 'string' ? body.username : '',
      email: typeof body.email === 'string' ? body.email : '',
      full_name: typeof body.full_name === 'string' ? body.full_name : '',
      password: typeof body.password === 'string' ? body.password : '',
      role: body.role === 'ADMIN' ? 'ADMIN' : 'REVIEWER',
      can_publish: Boolean(body.can_publish),
    });

    await appendAuditLog({
      ma_ho_so: created.user_id,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: 'TAO_TAI_KHOAN',
      noi_dung_truoc: {},
      noi_dung_sau: created,
      ly_do: `Tạo tài khoản ${created.role} (${created.username})`,
    });

    res.status(201).json({ ok: true, user: created });
  } catch (err: unknown) {
    res.status(400).json({
      error: (err as Error)?.message || 'Không thể tạo tài khoản mới.',
    });
  }
}

export async function updateUserAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const actor = req.currentUser!;
    const userId = req.params.userId;
    const body = req.body as Record<string, unknown>;
    const { before, after } = await updateUserAccount(
      userId,
      {
        full_name:
          typeof body.full_name === 'string' ? body.full_name : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        role:
          body.role === 'ADMIN' || body.role === 'REVIEWER'
            ? body.role
            : undefined,
        can_publish:
          typeof body.can_publish === 'boolean' ? body.can_publish : undefined,
        is_locked:
          typeof body.is_locked === 'boolean' ? body.is_locked : undefined,
        new_password:
          typeof body.new_password === 'string' ? body.new_password : undefined,
      },
      actor.user_id
    );

    const action =
      before.is_locked !== after.is_locked
        ? after.is_locked
          ? 'KHOA_TAI_KHOAN'
          : 'MO_KHOA_TAI_KHOAN'
        : 'CAP_NHAT_TAI_KHOAN';

    await appendAuditLog({
      ma_ho_so: userId,
      tai_khoan: actor.username,
      vai_tro: actor.role,
      hanh_dong: action,
      noi_dung_truoc: before,
      noi_dung_sau: after,
      ly_do:
        typeof body.ly_do === 'string' && body.ly_do.trim()
          ? body.ly_do.trim()
          : `Quản trị viên cập nhật tài khoản ${after.username}`,
    });

    res.json({ ok: true, user: after });
  } catch (err: unknown) {
    res.status(400).json({
      error: (err as Error)?.message || 'Không thể cập nhật tài khoản.',
    });
  }
}

export async function getAuditLogsAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const logs = await listAuditLogs({
      ma_ho_so:
        typeof req.query.ma_ho_so === 'string'
          ? req.query.ma_ho_so
          : undefined,
      tai_khoan:
        typeof req.query.tai_khoan === 'string'
          ? req.query.tai_khoan
          : undefined,
      hanh_dong:
        typeof req.query.hanh_dong === 'string'
          ? req.query.hanh_dong
          : undefined,
    });
    res.json({ logs });
  } catch {
    res.status(500).json({ error: 'Không thể tải lịch sử thao tác.' });
  }
}
