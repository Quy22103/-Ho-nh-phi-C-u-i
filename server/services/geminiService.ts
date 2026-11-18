import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { isGeminiConfigured, serverConfig } from '../config/env.ts';
import type {
  ArchiveRecordRaw,
  CitationItem,
  PublicRecord,
  QAResponse,
  TranscriptionSuggestionResponse,
} from '../../src/types/archive.ts';
import {
  isImagePublicationAllowed,
  isRecordPubliclyExportable,
  normalizeVerification,
  normalizeVietnamese,
  sanitizeRecordForPublic,
} from '../utils/archiveSanitizer.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

const EMPTY_DB_RESPONSE =
  'Hiện tại hệ thống chưa có tư liệu phù hợp với câu hỏi của bạn.';

const UNCLEAR_IMAGE_MESSAGE =
  'Ảnh chưa đủ rõ để đề xuất phiên âm đáng tin cậy. Cần ảnh rõ hơn hoặc người có chuyên môn kiểm tra trực tiếp.';

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: serverConfig.geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function searchMatchingRecords(
  question: string,
  records: ArchiveRecordRaw[]
): PublicRecord[] {
  const publicRaw = records.filter(isRecordPubliclyExportable);
  if (publicRaw.length === 0) return [];

  const qNorm = normalizeVietnamese(question);
  const rawTokens = qNorm
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .filter((t) => t.length >= 2);
  const hanMatches = question.match(/[\u4e00-\u9fff]+/gu) || [];

  const stopWords = new Set([
    'nao',
    'nhung',
    'cac',
    'co',
    'tu',
    'lieu',
    'ho',
    'so',
    'tim',
    'cho',
    'toi',
    'biet',
    've',
    'tai',
    'la',
    'gi',
    'duoc',
    'chua',
    'dang',
    'trong',
    'cua',
    'theo',
    'va',
    'hay',
    'khong',
  ]);
  const meaningfulTokens = rawTokens.filter((t) => !stopWords.has(t));

  const wantsUnverified =
    qNorm.includes('chua kiem chung') ||
    qNorm.includes('cho kiem chung') ||
    qNorm.includes('chua kiem');
  const wantsVerified =
    !wantsUnverified &&
    (qNorm.includes('da kiem chung') || qNorm.includes('duoc kiem chung'));
  const wantsUntranscribed =
    qNorm.includes('chua duoc phien am') ||
    qNorm.includes('chua co phien am') ||
    qNorm.includes('chua phien am');
  const wantsHasImages = qNorm.includes('co anh') || qNorm.includes('hinh anh');
  const wantsIntact = qNorm.includes('nguyen ven');

  const scored: Array<{ record: PublicRecord; score: number }> = [];

  for (const raw of publicRaw) {
    const pub = sanitizeRecordForPublic(raw);
    let score = 0;

    if (wantsVerified && pub.muc_kiem_chung === 'da_kiem_chung') score += 5;
    if (wantsVerified && pub.muc_kiem_chung !== 'da_kiem_chung') continue;

    if (wantsUnverified && pub.muc_kiem_chung === 'chua_kiem_chung') score += 5;
    if (wantsUnverified && pub.muc_kiem_chung !== 'chua_kiem_chung') continue;

    if (wantsUntranscribed && !pub.phien_am.noi_dung.trim()) score += 5;
    if (wantsUntranscribed && pub.phien_am.noi_dung.trim()) continue;

    if (wantsHasImages && (raw.images?.length || 0) > 0) score += 4;
    if (wantsHasImages && (raw.images?.length || 0) === 0) continue;

    if (
      wantsIntact &&
      normalizeVietnamese(pub.tinh_trang_ban_goc).includes('nguyen ven')
    ) {
      score += 5;
    }

    const blob = normalizeVietnamese(
      [
        pub.identifier,
        pub.title,
        pub.type,
        pub.description,
        pub.noi_luu_giu_hien_nay,
        pub.noi_luu_giu_tai_thoi_diem_tu_lieu,
        pub.loai_dia_diem_luu_giu,
        pub.ten_di_tich,
        pub.dong_ho_lien_quan,
        pub.gia_dinh_lien_quan,
        pub.nha_tho_ho,
        pub.loai_ban_dang_hien_thi,
        pub.tinh_trang_ban_goc,
        pub.phien_am.noi_dung,
        pub.dich_nghia.noi_dung,
        pub.coverage.thanh_pho,
        pub.coverage.don_vi_hanh_chinh_hien_nay,
        pub.coverage.don_vi_hanh_chinh_lich_su,
        pub.coverage.phuong_xa_hien_nay,
        pub.coverage.phuong_xa_lich_su,
        pub.coverage.thon_lang,
        pub.ghi_chu,
      ]
        .filter(Boolean)
        .join(' ')
    );

    for (const h of hanMatches) {
      if (pub.chu_han_nom.includes(h)) score += 6;
    }

    for (const token of meaningfulTokens) {
      if (blob.includes(token)) score += 2;
    }

    if (score > 0) {
      scored.push({ record: pub, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.record);
}

function toCitation(record: PublicRecord): CitationItem {
  return {
    identifier: record.identifier,
    title: record.title,
    noi_luu_giu_hien_nay:
      record.noi_luu_giu_hien_nay || 'Chưa có thông tin nơi lưu giữ',
    loai_ban_dang_hien_thi:
      record.loai_ban_dang_hien_thi || 'Chưa xác định loại bản',
    muc_kiem_chung: normalizeVerification(record.muc_kiem_chung),
  };
}

export async function answerArchiveQuestion(
  question: string,
  allRawRecords: ArchiveRecordRaw[]
): Promise<QAResponse> {
  if (!isGeminiConfigured()) {
    return {
      configured: false,
      found: false,
      answer:
        'Chức năng Hỏi đáp AI chưa được cấu hình GEMINI_API_KEY ở máy chủ. Các chức năng tra cứu danh sách, xem hồ sơ và xuất dữ liệu vẫn hoạt động bình thường.',
      citations: [],
      notice: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ.',
    };
  }

  const matched = searchMatchingRecords(question, allRawRecords);

  if (matched.length === 0) {
    return {
      configured: true,
      found: false,
      answer: EMPTY_DB_RESPONSE,
      citations: [],
    };
  }

  const contextPayload = matched.map((r) => ({
    identifier: r.identifier,
    title: r.title,
    type: r.type,
    noi_luu_giu_hien_nay: r.noi_luu_giu_hien_nay,
    loai_ban_dang_hien_thi: r.loai_ban_dang_hien_thi,
    tinh_trang_ban_goc: r.tinh_trang_ban_goc,
    muc_kiem_chung: r.muc_kiem_chung,
    coverage: r.coverage,
    dong_ho_lien_quan: r.dong_ho_lien_quan,
    gia_dinh_lien_quan: r.gia_dinh_lien_quan,
    nha_tho_ho: r.nha_tho_ho,
    chu_han_nom: r.chu_han_nom,
    phien_am: r.phien_am,
    dich_nghia: r.dich_nghia,
    date: r.date,
    description: r.description,
    ghi_chu: r.ghi_chu,
  }));

  const systemInstruction = `Bạn là trợ lý tra cứu của hệ thống "Hồ sơ số Hoành phi – Câu đối Hà Nội".
NGUYÊN TẮC BẮT BUỘC:
1. CHỈ trả lời dựa trên danh sách hồ sơ JSON được cung cấp trong ngữ cảnh. TUYỆT ĐỐI KHÔNG sử dụng kiến thức bên ngoài, không tự suy đoán, không bịa tên dòng họ, tên gia đình, địa điểm, niên đại, không tự sáng tác câu đối hay chữ Hán/Nôm.
2. Nếu dữ liệu trong danh sách không đủ để trả lời câu hỏi, hoặc không có bản ghi phù hợp, BẮT BUỘC trả lời đúng nguyên văn: "${EMPTY_DB_RESPONSE}" và để mảng citedIdentifiers rỗng.
3. Nếu bản ghi hoặc phần phiên âm/dịch nghĩa có trạng thái "chua_kiem_chung" hoặc "chua_doc_duoc", phải nêu rõ trạng thái đó, tuyệt đối không trình bày thông tin chưa kiểm chứng như sự thật đã xác nhận.
4. Khi trích dẫn hồ sơ, luôn nêu rõ Mã bản ghi (identifier), Tên tư liệu, Nơi lưu giữ hiện nay, Loại bản đang hiển thị và Mức kiểm chứng.`;

  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Câu hỏi của người dùng: "${question}"\n\nDữ liệu hồ sơ liên quan từ tulieu.json:\n${JSON.stringify(
      contextPayload,
      null,
      2
    )}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          found: {
            type: Type.BOOLEAN,
            description:
              'True nếu tìm thấy ít nhất 1 hồ sơ phù hợp để trả lời trong dữ liệu được cung cấp.',
          },
          answer: {
            type: Type.STRING,
            description: 'Câu trả lời tiếng Việt tổng hợp chặt chẽ từ dữ liệu.',
          },
          citedIdentifiers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Danh sách mã identifier của các hồ sơ thực tế đã sử dụng để trả lời.',
          },
        },
        required: ['found', 'answer', 'citedIdentifiers'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  const parsed = JSON.parse(rawText) as {
    found: boolean;
    answer: string;
    citedIdentifiers: string[];
  };

  if (!parsed.found || !parsed.citedIdentifiers?.length) {
    return {
      configured: true,
      found: false,
      answer: EMPTY_DB_RESPONSE,
      citations: [],
    };
  }

  const recordMap = new Map(matched.map((r) => [r.identifier, r]));
  const citations: CitationItem[] = [];
  for (const id of parsed.citedIdentifiers) {
    const rec = recordMap.get(id);
    if (rec) citations.push(toCitation(rec));
  }

  return {
    configured: true,
    found: citations.length > 0,
    answer:
      citations.length > 0
        ? parsed.answer
        : EMPTY_DB_RESPONSE,
    citations,
  };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export function resolveSafeImagePath(relativePath: string): string | null {
  if (!relativePath) return null;
  const cleaned = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(serverConfig.imagesDir, cleaned);
  if (!resolved.startsWith(serverConfig.imagesDir + path.sep)) {
    return null;
  }
  return resolved;
}

export async function suggestTranscriptionFromImage(
  record: ArchiveRecordRaw,
  imageId: string
): Promise<TranscriptionSuggestionResponse> {
  if (!isGeminiConfigured()) {
    return {
      configured: false,
      legible: false,
      label: 'ĐỀ XUẤT AI – CHƯA KIỂM CHỨNG',
      suggestion: '',
      error:
        'Chức năng đề xuất phiên âm chưa được cấu hình GEMINI_API_KEY ở máy chủ.',
    };
  }

  const imageObj = (record.images || []).find(
    (img) => img.image_id === imageId
  );
  if (!imageObj || !isImagePublicationAllowed(record, imageObj)) {
    throw new Error('IMAGE_FORBIDDEN');
  }

  const targetRel = imageObj.file || imageObj.thumbnail;
  let safePath = resolveSafeImagePath(targetRel);
  if (!safePath) {
    throw new Error('IMAGE_NOT_FOUND');
  }

  try {
    await fs.access(safePath);
  } catch {
    const fallbackRel = imageObj.thumbnail || imageObj.file;
    const fallbackPath = resolveSafeImagePath(fallbackRel);
    if (!fallbackPath) throw new Error('IMAGE_NOT_FOUND');
    await fs.access(fallbackPath);
    safePath = fallbackPath;
  }

  const bytes = await fs.readFile(safePath);
  const base64Data = bytes.toString('base64');
  const mimeType = getMimeType(safePath);

  const ai = createGeminiClient();
  const prompt = `Bạn đang hỗ trợ đọc chữ Hán/Nôm trên ảnh tư liệu hoành phi, câu đối di sản Hà Nội.
QUY TẮC BẮT BUỘC:
1. Chỉ đọc các chữ Hán/Nôm nhìn thấy rõ nét trong ảnh.
2. Tuyệt đối KHÔNG đoán chữ nếu ảnh bị mờ, thiếu nét, lóa sáng, mất chữ hoặc không đủ căn cứ.
3. Nếu không đọc được chắc chắn hoặc ảnh mờ/thiếu nét, đặt legible = false và ghi đúng câu sau vào notes: "${UNCLEAR_IMAGE_MESSAGE}".
4. Kết quả chỉ mang tính tham khảo cho người kiểm tra chuyên môn, không tự khẳng định niên đại hay địa danh ngoài những gì thấy rõ trong ảnh.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          legible: {
            type: Type.BOOLEAN,
            description:
              'True chỉ khi chữ Hán/Nôm trong ảnh đủ rõ nét để nhận diện đáng tin cậy.',
          },
          han_nom_detected: {
            type: Type.STRING,
            description: 'Chữ Hán/Nôm nhận diện được (để trống nếu illegible).',
          },
          phien_am_de_xuat: {
            type: Type.STRING,
            description: 'Đề xuất phiên âm Hán Việt (để trống nếu illegible).',
          },
          dich_nghia_tham_khao: {
            type: Type.STRING,
            description: 'Đề xuất dịch nghĩa tham khảo (để trống nếu illegible).',
          },
          notes: {
            type: Type.STRING,
            description:
              'Ghi chú về độ rõ của ảnh hoặc các chữ không đọc được.',
          },
        },
        required: [
          'legible',
          'han_nom_detected',
          'phien_am_de_xuat',
          'dich_nghia_tham_khao',
          'notes',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '').trim()) as {
    legible: boolean;
    han_nom_detected: string;
    phien_am_de_xuat: string;
    dich_nghia_tham_khao: string;
    notes: string;
  };

  if (!parsed.legible) {
    return {
      configured: true,
      legible: false,
      label: 'ĐỀ XUẤT AI – CHƯA KIỂM CHỨNG',
      suggestion: UNCLEAR_IMAGE_MESSAGE,
      notes: parsed.notes || UNCLEAR_IMAGE_MESSAGE,
    };
  }

  const combined = [
    parsed.han_nom_detected
      ? `Chữ Hán/Nôm nhận diện: ${parsed.han_nom_detected}`
      : '',
    parsed.phien_am_de_xuat
      ? `Phiên âm Hán Việt đề xuất: ${parsed.phien_am_de_xuat}`
      : '',
    parsed.dich_nghia_tham_khao
      ? `Dịch nghĩa tham khảo: ${parsed.dich_nghia_tham_khao}`
      : '',
    parsed.notes ? `Ghi chú: ${parsed.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    configured: true,
    legible: true,
    label: 'ĐỀ XUẤT AI – CHƯA KIỂM CHỨNG',
    suggestion: combined,
    han_nom_detected: parsed.han_nom_detected,
    phien_am_de_xuat: parsed.phien_am_de_xuat,
    dich_nghia_tham_khao: parsed.dich_nghia_tham_khao,
    notes: parsed.notes,
  };
}
