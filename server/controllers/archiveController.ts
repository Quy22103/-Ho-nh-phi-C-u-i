import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { isGeminiConfigured } from '../config/env.ts';
import type { CitizenSubmissionInput } from '../../src/types/archive.ts';
import {
  computeStats,
  filterPublicRecords,
  getPublicSources,
  readDataset,
  saveSubmission,
} from '../services/dataService.ts';
import {
  answerArchiveQuestion,
  resolveSafeImagePath,
  suggestTranscriptionFromImage,
} from '../services/geminiService.ts';
import {
  escapeCsvCell,
  IMAGE_RESTRICTION_MESSAGE,
  isImagePublicationAllowed,
  isRecordPubliclyExportable,
  sanitizeRecordForPublic,
} from '../utils/archiveSanitizer.ts';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  res.json({
    ok: true,
    geminiConfigured: isGeminiConfigured(),
  });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const dataset = await readDataset();
    const stats = computeStats(dataset);
    res.json({ metadata: dataset.metadata, stats });
  } catch (err) {
    console.error('Lỗi đọc thống kê:', err);
    res.status(500).json({ error: 'Không thể đọc dữ liệu thống kê từ hệ thống.' });
  }
}

export async function listRecords(req: Request, res: Response): Promise<void> {
  try {
    const dataset = await readDataset();
    const result = filterPublicRecords(dataset.records, {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      locationType:
        typeof req.query.locationType === 'string'
          ? req.query.locationType
          : undefined,
      thanhPho:
        typeof req.query.thanhPho === 'string' ? req.query.thanhPho : undefined,
      huyenLichSu:
        typeof req.query.huyenLichSu === 'string'
          ? req.query.huyenLichSu
          : undefined,
      xaHienNay:
        typeof req.query.xaHienNay === 'string'
          ? req.query.xaHienNay
          : undefined,
      xaLichSu:
        typeof req.query.xaLichSu === 'string' ? req.query.xaLichSu : undefined,
      thonLang:
        typeof req.query.thonLang === 'string' ? req.query.thonLang : undefined,
      dongHo:
        typeof req.query.dongHo === 'string' ? req.query.dongHo : undefined,
      nhaThoHo:
        typeof req.query.nhaThoHo === 'string' ? req.query.nhaThoHo : undefined,
      giaDinh:
        typeof req.query.giaDinh === 'string' ? req.query.giaDinh : undefined,
      verification:
        typeof req.query.verification === 'string'
          ? req.query.verification
          : undefined,
      edition:
        typeof req.query.edition === 'string' ? req.query.edition : undefined,
      condition:
        typeof req.query.condition === 'string'
          ? req.query.condition
          : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 12,
    });
    res.json(result);
  } catch (err) {
    console.error('Lỗi lọc hồ sơ:', err);
    res.status(500).json({ error: 'Không thể truy vấn danh sách hồ sơ.' });
  }
}

export async function getRecordDetail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const identifier = decodeURIComponent(req.params.identifier || '');
    const dataset = await readDataset();
    const found = dataset.records.find((r) => r.identifier === identifier);
    if (!found || !isRecordPubliclyExportable(found)) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tư liệu phù hợp.' });
      return;
    }

    const sanitized = sanitizeRecordForPublic(found);
    const linkedSources = getPublicSources(dataset).filter(
      (s) =>
        s.ho_so_lien_quan.includes(found.identifier) ||
        (Array.isArray(found.source) && found.source.includes(s.ma_nguon))
    );

    res.json({ record: sanitized, linkedSources });
  } catch (err) {
    console.error('Lỗi tải chi tiết hồ sơ:', err);
    res.status(500).json({ error: 'Không thể tải thông tin chi tiết hồ sơ.' });
  }
}

export async function getRecordImage(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const identifier = decodeURIComponent(req.params.identifier || '');
    const imageId = decodeURIComponent(req.params.imageId || '');
    const variant = req.query.variant === 'original' ? 'original' : 'thumbnail';

    const dataset = await readDataset();
    const record = dataset.records.find((r) => r.identifier === identifier);
    if (!record || !isRecordPubliclyExportable(record)) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tư liệu.' });
      return;
    }

    const img = (record.images || []).find((item) => item.image_id === imageId);
    if (!img) {
      res.status(404).json({ error: 'Không tìm thấy ảnh được yêu cầu.' });
      return;
    }

    if (!isImagePublicationAllowed(record, img)) {
      res.status(403).json({ error: IMAGE_RESTRICTION_MESSAGE });
      return;
    }

    const targetRel =
      variant === 'original'
        ? img.file || img.thumbnail
        : img.thumbnail || img.file;
    const primaryPath = resolveSafeImagePath(targetRel);

    let filePath = primaryPath;
    if (filePath) {
      try {
        await fs.access(filePath);
      } catch {
        const altDir = variant === 'original' ? 'originals' : 'thumbnails';
        const fallback = resolveSafeImagePath(
          path.join(altDir, path.basename(targetRel))
        );
        if (fallback) {
          try {
            await fs.access(fallback);
            filePath = fallback;
          } catch {
            filePath = null;
          }
        } else {
          filePath = null;
        }
      }
    }

    if (!filePath) {
      res.status(404).json({ error: 'Tệp ảnh chưa được nạp vào thư mục lưu trữ.' });
      return;
    }

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Lỗi truy xuất ảnh:', err);
    res.status(500).json({ error: 'Không thể tải ảnh tư liệu.' });
  }
}

export async function listSources(_req: Request, res: Response): Promise<void> {
  try {
    const dataset = await readDataset();
    const sources = getPublicSources(dataset);
    const recordLookup: Record<string, { identifier: string; title: string }> =
      {};
    for (const r of dataset.records) {
      if (isRecordPubliclyExportable(r)) {
        recordLookup[r.identifier] = {
          identifier: r.identifier,
          title: r.title,
        };
      }
    }
    res.json({ sources, recordLookup });
  } catch (err) {
    console.error('Lỗi đọc nguồn tư liệu:', err);
    res.status(500).json({ error: 'Không thể tải danh sách nguồn tư liệu.' });
  }
}

export async function postGeminiQA(req: Request, res: Response): Promise<void> {
  try {
    const question =
      typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      res.status(400).json({ error: 'Vui lòng nhập câu hỏi cần tra cứu.' });
      return;
    }
    if (question.length > 1000) {
      res
        .status(400)
        .json({ error: 'Câu hỏi vượt quá độ dài cho phép (tối đa 1000 ký tự).' });
      return;
    }

    const dataset = await readDataset();
    const result = await answerArchiveQuestion(question, dataset.records);
    res.json(result);
  } catch (err) {
    console.error('Lỗi Gemini QA:', err);
    res.status(500).json({
      error:
        'Không thể kết nối dịch vụ Gemini lúc này. Vui lòng kiểm tra cấu hình GEMINI_API_KEY hoặc thử lại sau.',
    });
  }
}

export async function postSuggestTranscription(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const identifier =
      typeof req.body?.identifier === 'string'
        ? req.body.identifier.trim()
        : '';
    const imageId =
      typeof req.body?.imageId === 'string' ? req.body.imageId.trim() : '';

    if (!identifier || !imageId) {
      res
        .status(400)
        .json({ error: 'Thiếu mã hồ sơ hoặc mã ảnh để đề xuất phiên âm.' });
      return;
    }

    const dataset = await readDataset();
    const record = dataset.records.find((r) => r.identifier === identifier);
    if (!record || !isRecordPubliclyExportable(record)) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ tư liệu.' });
      return;
    }

    const result = await suggestTranscriptionFromImage(record, imageId);
    res.json(result);
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg === 'IMAGE_FORBIDDEN') {
      res.status(403).json({ error: IMAGE_RESTRICTION_MESSAGE });
      return;
    }
    if (msg === 'IMAGE_NOT_FOUND') {
      res
        .status(404)
        .json({ error: 'Không tìm thấy tệp ảnh hợp lệ để phân tích.' });
      return;
    }
    console.error('Lỗi đề xuất phiên âm:', err);
    res.status(500).json({
      error:
        'Không thể tạo đề xuất phiên âm từ Gemini lúc này. Vui lòng thử lại sau.',
    });
  }
}

export async function exportJson(_req: Request, res: Response): Promise<void> {
  try {
    const dataset = await readDataset();
    const publicRecords = dataset.records
      .filter(isRecordPubliclyExportable)
      .map(sanitizeRecordForPublic);
    const publicSources = getPublicSources(dataset);

    const payload = {
      metadata: {
        ...dataset.metadata,
        ngay_xuat: getTodayDateString(),
        tong_so_ho_so_cong_bo: publicRecords.length,
      },
      records: publicRecords,
      sources: publicSources,
    };

    const filename = `tu-lieu-hoanh-phi-cau-doi-ha-noi-${getTodayDateString()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Lỗi xuất JSON:', err);
    res.status(500).json({ error: 'Xuất dữ liệu JSON thất bại.' });
  }
}

export async function exportCsv(_req: Request, res: Response): Promise<void> {
  try {
    const dataset = await readDataset();
    const publicRecords = dataset.records
      .filter(isRecordPubliclyExportable)
      .map(sanitizeRecordForPublic);

    const headers = [
      'Mã định danh (identifier)',
      'Tên tư liệu (title)',
      'Loại tài nguyên (type)',
      'Người tạo lập (creator)',
      'Thời gian tạo lập (date)',
      'Chủ đề (subject)',
      'Mô tả (description)',
      'Đơn vị công bố (publisher)',
      'Người đóng góp được công bố (contributor)',
      'Định dạng (format)',
      'Nguồn tư liệu (source)',
      'Ngôn ngữ (language)',
      'Tư liệu liên quan (relation)',
      'Thành phố',
      'Đơn vị hành chính hiện nay',
      'Đơn vị hành chính lịch sử',
      'Phường/Xã hiện nay',
      'Phường/Xã lịch sử',
      'Thôn/Làng',
      'Thời gian địa bàn',
      'Quyền sử dụng (rights)',
      'Nơi lưu giữ hiện nay',
      'Nơi lưu giữ tại thời điểm tư liệu',
      'Loại địa điểm lưu giữ',
      'Dòng họ liên quan',
      'Nhà thờ họ',
      'Gia đình liên quan',
      'Loại bản đang hiển thị',
      'Tình trạng bản gốc',
      'Số đăng ký',
      'Người cho phép công bố',
      'Phạm vi được phép',
      'Mức kiểm chứng tổng thể',
      'Chữ Hán/Nôm nguyên bản',
      'Phiên âm Hán Việt',
      'Trạng thái phiên âm',
      'Dịch nghĩa tiếng Việt',
      'Trạng thái dịch nghĩa',
      'Ghi chú',
      'Số ảnh được phép công bố',
      'Ngày cập nhật',
    ];

    const rows = publicRecords.map((r) => [
      r.identifier,
      r.title,
      r.type,
      r.creator,
      r.date,
      r.subject.join('; '),
      r.description,
      r.publisher,
      r.contributor.join('; '),
      r.format,
      r.source.join('; '),
      r.language,
      r.relation.join('; '),
      r.coverage.thanh_pho,
      r.coverage.don_vi_hanh_chinh_hien_nay,
      r.coverage.don_vi_hanh_chinh_lich_su,
      r.coverage.phuong_xa_hien_nay,
      r.coverage.phuong_xa_lich_su,
      r.coverage.thon_lang,
      r.coverage.thoi_gian,
      r.rights,
      r.noi_luu_giu_hien_nay,
      r.noi_luu_giu_tai_thoi_diem_tu_lieu,
      r.loai_dia_diem_luu_giu || '',
      r.dong_ho_lien_quan || '',
      r.nha_tho_ho || '',
      r.gia_dinh_lien_quan || '',
      r.loai_ban_dang_hien_thi,
      r.tinh_trang_ban_goc,
      r.so_dang_ky,
      r.nguoi_cho_phep_cong_bo,
      r.pham_vi_duoc_phep,
      r.muc_kiem_chung,
      r.chu_han_nom,
      r.phien_am.noi_dung,
      r.phien_am.trang_thai,
      r.dich_nghia.noi_dung,
      r.dich_nghia.trang_thai,
      r.ghi_chu,
      r.images.length,
      r.ngay_cap_nhat,
    ]);

    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ];

    const bom = '\uFEFF';
    const filename = `tu-lieu-hoanh-phi-cau-doi-ha-noi-${getTodayDateString()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bom + csvLines.join('\r\n'));
  } catch (err) {
    console.error('Lỗi xuất CSV:', err);
    res.status(500).json({ error: 'Xuất dữ liệu CSV thất bại.' });
  }
}

export async function postSubmission(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body as Partial<CitizenSubmissionInput>;
    const cleanText = (v: unknown, max = 1000) =>
      typeof v === 'string' ? v.trim().slice(0, max) : '';

    const payload: CitizenSubmissionInput = {
      ten_tu_lieu: cleanText(body.ten_tu_lieu, 300),
      loai_tu_lieu: cleanText(body.loai_tu_lieu, 100),
      noi_luu_giu: cleanText(body.noi_luu_giu, 300),
      loai_dia_diem: cleanText(body.loai_dia_diem, 100),
      dia_danh_hien_nay: cleanText(body.dia_danh_hien_nay, 300),
      dia_danh_lich_su: cleanText(body.dia_danh_lich_su, 300),
      thon_lang: cleanText(body.thon_lang, 200),
      dong_ho_hoac_gia_dinh: cleanText(body.dong_ho_hoac_gia_dinh, 200),
      chu_han_nom: cleanText(body.chu_han_nom, 1000),
      phien_am_de_xuat: cleanText(body.phien_am_de_xuat, 1000),
      nguoi_cung_cap: cleanText(body.nguoi_cung_cap, 200),
      lien_he: cleanText(body.lien_he, 200),
      nguon_xac_minh: cleanText(body.nguon_xac_minh, 500),
      ghi_chu: cleanText(body.ghi_chu, 1500),
    };

    if (
      !payload.ten_tu_lieu ||
      !payload.noi_luu_giu ||
      !payload.nguoi_cung_cap ||
      !payload.nguon_xac_minh
    ) {
      res.status(400).json({
        error:
          'Vui lòng điền đầy đủ Tên tư liệu, Nơi lưu giữ, Người cung cấp và Nguồn xác minh.',
      });
      return;
    }

    const saved = await saveSubmission(payload);
    res.status(201).json({
      ok: true,
      message:
        'Đã ghi nhận phiếu đề xuất bổ sung vào hàng chờ kiểm chứng của Ban quản lý. Dữ liệu chính thức sẽ chỉ cập nhật sau khi được xác minh.',
      ...saved,
    });
  } catch (err) {
    console.error('Lỗi lưu đề xuất bổ sung:', err);
    res.status(500).json({ error: 'Không thể lưu phiếu đề xuất bổ sung.' });
  }
}
