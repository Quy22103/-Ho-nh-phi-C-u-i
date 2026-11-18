import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileCheck,
  Image as ImageIcon,
  Save,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  fetchAdminSubmissionDetail,
  updateAdminSubmission,
} from '../../api/client.ts';
import { ProcessingStatusBadge } from '../../components/ProcessingStatusBadge.tsx';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type {
  GranularVerification,
  ImagePermission,
  ImageType,
  SubmissionRecord,
  UserAccountSafe,
  VerificationLevel,
} from '../../types/archive.ts';

interface AdminSubmissionDetailProps {
  submissionId: string;
  currentUser: UserAccountSafe;
  onBack: () => void;
  onUpdated?: () => void;
}

const GRANULAR_FIELDS: Array<{
  key: keyof GranularVerification;
  label: string;
}> = [
  { key: 'dia_diem', label: 'Thông tin địa điểm' },
  { key: 'nguon_tu_lieu', label: 'Nguồn tư liệu' },
  { key: 'chu_han_nom', label: 'Chữ Hán/Nôm' },
  { key: 'phien_am', label: 'Phiên âm' },
  { key: 'dich_nghia', label: 'Dịch nghĩa' },
  { key: 'nien_dai', label: 'Thông tin niên đại' },
];

const IMAGE_TYPE_LABELS: Array<{ value: ImageType; label: string }> = [
  { value: 'toan_trang', label: 'Ảnh toàn trang' },
  { value: 'can_canh', label: 'Ảnh cận cảnh' },
  { value: 'can_canh_trai', label: 'Ảnh cận cảnh vế trái' },
  { value: 'can_canh_phai', label: 'Ảnh cận cảnh vế phải' },
  { value: 'can_canh_chu', label: 'Ảnh cận cảnh mặt chữ' },
  { value: 'ban_dap', label: 'Ảnh bản dập' },
  { value: 'ban_sao', label: 'Ảnh bản sao' },
  { value: 'khac', label: 'Ảnh tư liệu khác' },
];

export function AdminSubmissionDetail({
  submissionId,
  currentUser,
  onBack,
  onUpdated,
}: AdminSubmissionDetailProps) {
  const [sub, setSub] = useState<SubmissionRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [reason, setReason] = useState('');
  const [overallVerification, setOverallVerification] =
    useState<VerificationLevel>('chua_kiem_chung');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    fetchAdminSubmissionDetail(submissionId)
      .then((res) => {
        if (!mounted) return;
        setSub(res.submission);
        setOverallVerification(
          res.submission.muc_kiem_chung || 'chua_kiem_chung'
        );
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setError('Không thể tải chi tiết hồ sơ duyệt tư liệu.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [submissionId]);

  if (loading) {
    return (
      <div className="p-8 border border-limestone rounded-lg bg-parchment/30 animate-pulse h-64" />
    );
  }

  if (!sub) {
    return (
      <div className="p-6 border border-limestone rounded-lg bg-ivory space-y-3">
        <p className="text-sm text-red-900">
          {error || 'Không tìm thấy hồ sơ tiếp nhận.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-bronze hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const authorityComplete =
    Boolean(sub.nguon_anh?.trim()) &&
    Boolean(sub.nguoi_cho_phep_cong_bo?.trim()) &&
    Boolean(sub.pham_vi_su_dung?.trim()) &&
    sub.pham_vi_su_dung.trim().toLowerCase() !== 'không công bố' &&
    sub.pham_vi_su_dung.trim().toLowerCase() !== 'khong cong bo' &&
    sub.xac_nhan_quyen_cong_bo === true;

  const fullViewImages = sub.pending_images.filter(
    (img) => img.image_type === 'toan_trang'
  );
  const closeUpImages = sub.pending_images.filter(
    (img) => img.image_type !== 'toan_trang'
  );

  const runAction = async (
    action:
      | 'MO_KIEM_TRA'
      | 'LUU_BAN_NHAP'
      | 'DUYET_VA_CONG_KHAI'
      | 'XAC_NHAN_THONG_TIN'
      | 'YEU_CAU_BO_SUNG'
      | 'TU_CHOI',
    targetStatusOverride?: 'CHO_CONG_KHAI' | 'DA_CONG_KHAI'
  ) => {
    const trimmedReason = reason.trim();
    if (
      (action === 'TU_CHOI' || action === 'YEU_CAU_BO_SUNG') &&
      !trimmedReason
    ) {
      setError(
        action === 'TU_CHOI'
          ? 'Bắt buộc nhập lý do trước khi từ chối tư liệu.'
          : 'Bắt buộc nhập lý do trước khi yêu cầu bổ sung tư liệu.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload: Record<string, unknown> = {
        action,
        ly_do: trimmedReason,
        target_status: targetStatusOverride,
        // Core & 15 Dublin Core fields
        ten_tu_lieu: sub.ten_tu_lieu,
        ten_goi_khac: sub.ten_goi_khac || '',
        loai_tu_lieu: sub.loai_tu_lieu,
        creator: sub.creator || '',
        subject: sub.subject || [],
        description: sub.description || '',
        publisher:
          sub.publisher || 'Hồ sơ số Hoành phi – Câu đối Hà Nội',
        format: sub.format || '',
        language: sub.language || 'Chữ Hán/Nôm, Tiếng Việt',
        relation: sub.relation || [],
        rights: sub.rights || '',
        // Location & clan
        noi_luu_giu: sub.noi_luu_giu,
        noi_luu_giu_tai_thoi_diem_tu_lieu:
          sub.noi_luu_giu_tai_thoi_diem_tu_lieu || sub.noi_luu_giu,
        loai_dia_diem: sub.loai_dia_diem,
        ten_di_tich: sub.ten_di_tich || '',
        nha_tho_ho: sub.nha_tho_ho || '',
        dia_danh_hien_nay: sub.dia_danh_hien_nay,
        phuong_xa_hien_nay: sub.phuong_xa_hien_nay || '',
        dia_danh_lich_su: sub.dia_danh_lich_su,
        phuong_xa_lich_su: sub.phuong_xa_lich_su || '',
        thon_lang: sub.thon_lang,
        dong_ho_hoac_gia_dinh: sub.dong_ho_hoac_gia_dinh,
        gia_dinh_lien_quan: sub.gia_dinh_lien_quan || '',
        // Record metadata
        loai_ban_dang_hien_thi: sub.loai_ban_dang_hien_thi || '',
        tinh_trang_ban_goc: sub.tinh_trang_ban_goc || 'Không xác định',
        so_dang_ky: sub.so_dang_ky || '',
        // Transcription & translation
        chu_han_nom: sub.chu_han_nom,
        phien_am_de_xuat: sub.phien_am_de_xuat,
        dich_nghia_de_xuat: sub.dich_nghia_de_xuat,
        giai_thich_noi_dung: sub.giai_thich_noi_dung || '',
        nien_dai_de_xuat: sub.nien_dai_de_xuat,
        // Source & rights
        nguon_xac_minh: sub.nguon_xac_minh,
        nguon_anh: sub.nguon_anh,
        nguoi_cho_phep_cong_bo: sub.nguoi_cho_phep_cong_bo,
        pham_vi_su_dung: sub.pham_vi_su_dung,
        phan_khong_cong_bo: sub.phan_khong_cong_bo || '',
        xac_nhan_quyen_cong_bo: sub.xac_nhan_quyen_cong_bo,
        cong_khai_nguoi_cung_cap: sub.cong_khai_nguoi_cung_cap,
        ghi_chu_kiem_duyet: sub.ghi_chu_kiem_duyet || '',
        // Decoupled verification & image permissions
        kiem_chung_chi_tiet: sub.kiem_chung_chi_tiet,
        muc_kiem_chung: overallVerification,
        pending_images: sub.pending_images,
      };
      const res = await updateAdminSubmission(sub.submission_id, payload);
      setSub(res.submission);
      setOverallVerification(
        res.submission.muc_kiem_chung || overallVerification
      );
      setReason('');
      setSuccessMsg(
        `Đã cập nhật hồ sơ thành công. Trạng thái hiện tại: ${res.submission.trang_thai_xu_ly}.`
      );
      onUpdated?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể lưu thay đổi hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  const renderImageCard = (img: SubmissionRecord['pending_images'][number]) => {
    const typeLabel =
      IMAGE_TYPE_LABELS.find((t) => t.value === img.image_type)?.label ||
      img.image_type;
    return (
      <div
        key={img.image_id}
        className="border border-limestone rounded-lg p-3.5 space-y-3 bg-parchment/20"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-walnut-deep inline-flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-bronze" />
            <span>{typeLabel}</span>
          </span>
          <span className="font-mono text-[11px] text-muted">
            {img.image_id}
          </span>
        </div>

        <div className="bg-stone-900 rounded overflow-hidden max-h-64 flex items-center justify-center">
          <img
            src={`/api/admin/submissions/${encodeURIComponent(sub.submission_id)}/images/${encodeURIComponent(img.image_id)}`}
            alt={img.caption || typeLabel}
            className="max-h-64 object-contain"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1">
              Phân loại ảnh (toàn trang / cận cảnh)
            </label>
            <select
              value={img.image_type}
              onChange={(e) =>
                setSub({
                  ...sub,
                  pending_images: sub.pending_images.map((item) =>
                    item.image_id === img.image_id
                      ? { ...item, image_type: e.target.value as ImageType }
                      : item
                  ),
                })
              }
              className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
            >
              {IMAGE_TYPE_LABELS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1">
              Quyền công bố riêng cho ảnh này
            </label>
            <select
              value={img.permission}
              onChange={(e) =>
                setSub({
                  ...sub,
                  pending_images: sub.pending_images.map((item) =>
                    item.image_id === img.image_id
                      ? {
                          ...item,
                          permission: e.target.value as ImagePermission,
                        }
                      : item
                  ),
                })
              }
              className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded font-medium"
            >
              <option value="cho_xac_nhan">Chờ xác nhận quyền công bố</option>
              <option value="duoc_phep_cong_bo" disabled={!authorityComplete}>
                Được phép công bố
                {!authorityComplete ? ' (Cần đủ căn cứ bên trên)' : ''}
              </option>
              <option value="khong_cong_bo">
                Không công bố (giữ nội bộ)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1">
              Chú thích ảnh
            </label>
            <input
              type="text"
              value={img.caption}
              onChange={(e) =>
                setSub({
                  ...sub,
                  pending_images: sub.pending_images.map((item) =>
                    item.image_id === img.image_id
                      ? { ...item, caption: e.target.value }
                      : item
                  ),
                })
              }
              placeholder="Chú thích ảnh"
              className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1">
              Nguồn ảnh riêng (nếu khác)
            </label>
            <input
              type="text"
              value={img.source}
              onChange={(e) =>
                setSub({
                  ...sub,
                  pending_images: sub.pending_images.map((item) =>
                    item.image_id === img.image_id
                      ? { ...item, source: e.target.value }
                      : item
                  ),
                })
              }
              placeholder="Nguồn chụp / cung cấp ảnh"
              className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-limestone pb-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-bronze hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Quản lý tư liệu</span>
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold text-walnut-deep">
              Chi tiết duyệt tư liệu: {sub.ten_tu_lieu}
            </h2>
            <span className="font-mono text-xs bg-parchment px-2 py-0.5 rounded border border-limestone">
              {sub.submission_id}
            </span>
            <ProcessingStatusBadge status={sub.trang_thai_xu_ly} />
            <VerificationBadge status={overallVerification} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-limestone bg-ivory rounded hover:bg-parchment"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              {editMode ? 'Đóng chế độ sửa trường' : 'Chỉnh sửa thông tin'}
            </span>
          </button>
          {(sub.trang_thai_xu_ly === 'PENDING' ||
            sub.trang_thai_xu_ly === 'CHO_XAC_NHAN') && (
            <button
              type="button"
              disabled={saving}
              onClick={() => runAction('MO_KIEM_TRA')}
              className="px-3 py-2 text-xs font-semibold border border-sky-300 bg-sky-50 text-sky-900 rounded hover:bg-sky-100"
            >
              Chuyển sang Đang kiểm tra
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded border border-red-200 bg-red-50 text-red-900 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 p-3.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Record metadata, 15 DC fields, Clan & Location, Images & Rights, Transcription & Translation */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Thông tin bản ghi */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2">
              1. Thông tin bản ghi tiếp nhận
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted block">Mã tiếp nhận</span>
                <span className="font-mono font-semibold text-walnut-deep">
                  {sub.submission_id}
                </span>
              </div>
              <div>
                <span className="text-muted block">Hình thức đóng góp</span>
                <span className="font-medium text-ink">
                  {sub.loai_dong_gop === 'bo_sung_chinh_sua'
                    ? `Bổ sung / chỉnh sửa (${sub.target_identifier || 'Không rõ'})`
                    : 'Đề xuất hồ sơ mới'}
                </span>
              </div>
              <div>
                <span className="text-muted block">Ngày gửi / Cập nhật</span>
                <span className="font-mono text-ink">
                  {new Date(sub.ngay_gui).toLocaleString('vi-VN')} ·{' '}
                  {new Date(sub.ngay_cap_nhat).toLocaleString('vi-VN')}
                </span>
              </div>
              <div>
                <span className="text-muted block">Mã hồ sơ chính thức</span>
                <span className="font-mono text-ink font-semibold">
                  {sub.official_identifier || 'Chưa cấp mã chính thức'}
                </span>
              </div>
              <div>
                <label className="text-muted block mb-1">
                  Số đăng ký / Ký hiệu hồ sơ
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.so_dang_ky || ''}
                    onChange={(e) =>
                      setSub({ ...sub, so_dang_ky: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded font-mono"
                  />
                ) : (
                  <span className="font-mono text-ink">
                    {sub.so_dang_ky || 'Sẽ cấp tự động khi duyệt'}
                  </span>
                )}
              </div>
              <div>
                <label className="text-muted block mb-1">
                  Tình trạng bản gốc
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.tinh_trang_ban_goc || ''}
                    onChange={(e) =>
                      setSub({ ...sub, tinh_trang_ban_goc: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <span className="text-ink">
                    {sub.tinh_trang_ban_goc || 'Không xác định'}
                  </span>
                )}
              </div>
              <div>
                <label className="text-muted block mb-1">
                  Loại bản đang hiển thị
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.loai_ban_dang_hien_thi || ''}
                    onChange={(e) =>
                      setSub({
                        ...sub,
                        loai_ban_dang_hien_thi: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <span className="text-ink">
                    {sub.loai_ban_dang_hien_thi ||
                      'Hồ sơ số hóa từ tư liệu tiếp nhận'}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted block mb-1">
                  Người cung cấp / Liên hệ nội bộ
                </span>
                <p className="text-ink font-medium">{sub.nguoi_cung_cap}</p>
                <p className="font-mono text-[11px] text-muted">
                  Liên hệ bảo mật: {sub.lien_he || 'Không cung cấp'}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-ink pt-1">
              <input
                type="checkbox"
                checked={sub.cong_khai_nguoi_cung_cap}
                onChange={(e) =>
                  setSub({
                    ...sub,
                    cong_khai_nguoi_cung_cap: e.target.checked,
                  })
                }
              />
              <span>
                Cho phép hiển thị tên người cung cấp trong mục Contributor khi công khai
              </span>
            </label>

            {sub.ghi_chu && (
              <div className="p-3 rounded border border-limestone bg-parchment/40 text-xs text-ink">
                <span className="font-semibold text-walnut-deep">
                  Ghi chú của người gửi:{' '}
                </span>
                <span>{sub.ghi_chu}</span>
              </div>
            )}
          </section>

          {/* 2. 15 trường Dublin Core */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2">
              2. Chuẩn mô tả 15 trường Dublin Core
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Title (Nhan đề tư liệu)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.ten_tu_lieu}
                    onChange={(e) =>
                      setSub({ ...sub, ten_tu_lieu: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink font-medium">{sub.ten_tu_lieu}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Tên gọi khác (Alternative Title)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.ten_goi_khac || ''}
                    onChange={(e) =>
                      setSub({ ...sub, ten_goi_khac: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.ten_goi_khac || 'Không có'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Type (Loại hình tư liệu)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.loai_tu_lieu}
                    onChange={(e) =>
                      setSub({ ...sub, loai_tu_lieu: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">{sub.loai_tu_lieu}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Creator (Tác giả / Người lập)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.creator || ''}
                    onChange={(e) =>
                      setSub({ ...sub, creator: e.target.value })
                    }
                    placeholder="Chưa rõ / tên người lập"
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.creator || 'Chưa rõ / Cộng đồng đóng góp'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Subject (Từ khóa chủ đề, cách nhau dấu phẩy)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={(sub.subject || []).join(', ')}
                    onChange={(e) =>
                      setSub({
                        ...sub,
                        subject: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {(sub.subject || []).length > 0
                      ? sub.subject!.join(', ')
                      : `${sub.loai_tu_lieu}, Hà Nội`}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Date (Niên đại tư liệu)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.nien_dai_de_xuat}
                    onChange={(e) =>
                      setSub({ ...sub, nien_dai_de_xuat: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.nien_dai_de_xuat || 'Chưa xác định'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Publisher (Đơn vị phát hành hồ sơ số)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.publisher || ''}
                    onChange={(e) =>
                      setSub({ ...sub, publisher: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.publisher || 'Hồ sơ số Hoành phi – Câu đối Hà Nội'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Contributor (Người đóng góp công khai)
                </label>
                <p className="text-ink">
                  {sub.cong_khai_nguoi_cung_cap
                    ? sub.nguoi_cung_cap
                    : 'Ẩn tên cá nhân (chỉ lưu nội bộ)'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Format (Định dạng vật lý / số)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.format || ''}
                    onChange={(e) =>
                      setSub({ ...sub, format: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.format || 'Ảnh kỹ thuật số & bản ghi mô tả'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Language (Ngôn ngữ)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.language || ''}
                    onChange={(e) =>
                      setSub({ ...sub, language: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.language || 'Chữ Hán/Nôm, Tiếng Việt'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Source (Nguồn tư liệu & xác minh)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.nguon_xac_minh}
                    onChange={(e) =>
                      setSub({ ...sub, nguon_xac_minh: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.nguon_xac_minh || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Relation (Hồ sơ / di tích liên quan)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={(sub.relation || []).join(', ')}
                    onChange={(e) =>
                      setSub({
                        ...sub,
                        relation: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {(sub.relation || []).length > 0
                      ? sub.relation!.join(', ')
                      : sub.noi_luu_giu}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Identifier (Mã định danh chính thức)
                </label>
                <p className="font-mono text-ink">
                  {sub.official_identifier || sub.so_dang_ky || sub.submission_id}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Rights (Thông tin bản quyền / quyền sử dụng)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.rights || ''}
                    onChange={(e) =>
                      setSub({ ...sub, rights: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.rights || sub.pham_vi_su_dung || 'Chưa xác định quyền công bố'}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-muted mb-1">
                  Coverage (Phạm vi không gian – thời gian)
                </label>
                <p className="text-ink">
                  Hà Nội · {sub.dia_danh_hien_nay || 'Chưa rõ đơn vị hiện nay'}
                  {sub.phuong_xa_hien_nay ? `, ${sub.phuong_xa_hien_nay}` : ''}
                  {sub.thon_lang ? ` · ${sub.thon_lang}` : ''}
                  {sub.dia_danh_lich_su
                    ? ` (Lịch sử: ${sub.dia_danh_lich_su}${sub.phuong_xa_lich_su ? `, ${sub.phuong_xa_lich_su}` : ''})`
                    : ''}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-muted mb-1">
                  Description (Mô tả khái quát)
                </label>
                {editMode ? (
                  <textarea
                    rows={2}
                    value={sub.description || ''}
                    onChange={(e) =>
                      setSub({ ...sub, description: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.description ||
                      sub.dich_nghia_de_xuat ||
                      `${sub.loai_tu_lieu} tại ${sub.noi_luu_giu}`}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 3. Thông tin dòng họ, gia đình và địa điểm */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2">
              3. Thông tin dòng họ, gia đình và địa điểm lưu giữ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Dòng họ liên quan
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.dong_ho_hoac_gia_dinh}
                    onChange={(e) =>
                      setSub({ ...sub, dong_ho_hoac_gia_dinh: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.dong_ho_hoac_gia_dinh || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Gia đình / chi phái liên quan
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.gia_dinh_lien_quan || ''}
                    onChange={(e) =>
                      setSub({ ...sub, gia_dinh_lien_quan: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.gia_dinh_lien_quan || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Nhà thờ họ / Từ đường
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.nha_tho_ho || ''}
                    onChange={(e) =>
                      setSub({ ...sub, nha_tho_ho: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.nha_tho_ho || 'Không áp dụng / Chưa rõ'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Tên di tích (nếu là đình/chùa/đền/miếu)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.ten_di_tich || ''}
                    onChange={(e) =>
                      setSub({ ...sub, ten_di_tich: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.ten_di_tich || sub.noi_luu_giu}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Loại địa điểm lưu giữ
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.loai_dia_diem}
                    onChange={(e) =>
                      setSub({ ...sub, loai_dia_diem: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">{sub.loai_dia_diem}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Nơi lưu giữ hiện nay
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.noi_luu_giu}
                    onChange={(e) =>
                      setSub({ ...sub, noi_luu_giu: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink font-medium">{sub.noi_luu_giu}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Nơi lưu giữ tại thời điểm tư liệu
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.noi_luu_giu_tai_thoi_diem_tu_lieu || ''}
                    onChange={(e) =>
                      setSub({
                        ...sub,
                        noi_luu_giu_tai_thoi_diem_tu_lieu: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.noi_luu_giu_tai_thoi_diem_tu_lieu || sub.noi_luu_giu}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Thôn / Làng / Tổ dân phố
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.thon_lang}
                    onChange={(e) =>
                      setSub({ ...sub, thon_lang: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.thon_lang || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Quận/Huyện hiện nay
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.dia_danh_hien_nay}
                    onChange={(e) =>
                      setSub({ ...sub, dia_danh_hien_nay: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.dia_danh_hien_nay || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Phường/Xã hiện nay
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.phuong_xa_hien_nay || ''}
                    onChange={(e) =>
                      setSub({ ...sub, phuong_xa_hien_nay: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.phuong_xa_hien_nay || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Đơn vị hành chính lịch sử
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.dia_danh_lich_su}
                    onChange={(e) =>
                      setSub({ ...sub, dia_danh_lich_su: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.dia_danh_lich_su || 'Chưa có thông tin'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">
                  Tổng / Xã lịch sử
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={sub.phuong_xa_lich_su || ''}
                    onChange={(e) =>
                      setSub({ ...sub, phuong_xa_lich_su: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  />
                ) : (
                  <p className="text-ink">
                    {sub.phuong_xa_lich_su || 'Chưa có thông tin'}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 4. Ảnh toàn trang & Ảnh cận cảnh + Quyền công bố */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2">
              4. Ảnh toàn trang, ảnh cận cảnh & Kiểm tra quyền công bố (
              {sub.pending_images.length})
            </h3>

            <div
              className={`p-3 rounded border text-xs flex items-start gap-2 ${
                authorityComplete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              {authorityComplete ? (
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {authorityComplete
                    ? 'Hồ sơ đã có đủ thông tin quyền công bố ảnh.'
                    : 'Chưa đủ căn cứ quyền công bố ảnh (ảnh vẫn đang bị khóa không công khai).'}
                </p>
                <p className="mt-0.5 opacity-90">
                  Hệ thống không mặc định công khai toàn bộ ảnh khi duyệt hồ sơ. Chỉ các ảnh có đủ Nguồn ảnh, Người cho phép công bố, Phạm vi sử dụng, dấu xác nhận quyền công bố và quyền riêng ở mức “Được phép công bố” mới được hiển thị công khai.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-parchment/40 p-3.5 rounded border border-limestone">
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Nguồn ảnh
                </label>
                <input
                  type="text"
                  value={sub.nguon_anh}
                  onChange={(e) =>
                    setSub({ ...sub, nguon_anh: e.target.value })
                  }
                  placeholder="Ví dụ: Ảnh tự chụp tại di tích / gia đình cung cấp"
                  className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Người cho phép công bố
                </label>
                <input
                  type="text"
                  value={sub.nguoi_cho_phep_cong_bo}
                  onChange={(e) =>
                    setSub({
                      ...sub,
                      nguoi_cho_phep_cong_bo: e.target.value,
                    })
                  }
                  placeholder="Ban quản lý di tích / Trưởng họ..."
                  className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Phạm vi được phép công bố
                </label>
                <input
                  type="text"
                  value={sub.pham_vi_su_dung}
                  onChange={(e) =>
                    setSub({ ...sub, pham_vi_su_dung: e.target.value })
                  }
                  placeholder="Công khai phục vụ nghiên cứu, tra cứu"
                  className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-muted mb-1">
                  Phần không công bố (nếu có hạn chế)
                </label>
                <input
                  type="text"
                  value={sub.phan_khong_cong_bo || ''}
                  onChange={(e) =>
                    setSub({ ...sub, phan_khong_cong_bo: e.target.value })
                  }
                  placeholder="Ví dụ: Che số điện thoại, giữ ảnh cận cảnh nội bộ"
                  className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 pt-1 font-medium text-ink">
                <input
                  type="checkbox"
                  checked={sub.xac_nhan_quyen_cong_bo}
                  onChange={(e) =>
                    setSub({
                      ...sub,
                      xac_nhan_quyen_cong_bo: e.target.checked,
                    })
                  }
                />
                <span>
                  Đã xác minh đủ căn cứ quyền công bố ảnh & thông tin liên quan
                </span>
              </label>
            </div>

            {sub.pending_images.length === 0 ? (
              <p className="text-xs text-muted">
                Người gửi không đính kèm ảnh tư liệu nào.
              </p>
            ) : (
              <div className="space-y-4">
                {fullViewImages.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-bronze">
                      Ảnh toàn trang ({fullViewImages.length})
                    </h4>
                    <div className="space-y-3">
                      {fullViewImages.map(renderImageCard)}
                    </div>
                  </div>
                )}

                {closeUpImages.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-bronze">
                      Ảnh cận cảnh / Bản dập / Tư liệu bổ trợ (
                      {closeUpImages.length})
                    </h4>
                    <div className="space-y-3">
                      {closeUpImages.map(renderImageCard)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 5. Phiên âm & Dịch nghĩa */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-3 text-sm">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2">
              5. Chữ Hán/Nôm, Phiên âm và Dịch nghĩa
            </h3>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Nguyên bản chữ Hán/Nôm
              </label>
              {editMode ? (
                <textarea
                  rows={2}
                  value={sub.chu_han_nom}
                  onChange={(e) =>
                    setSub({ ...sub, chu_han_nom: e.target.value })
                  }
                  className="w-full px-3 py-1.5 font-hannom text-lg bg-white border border-limestone rounded"
                />
              ) : (
                <p className="font-hannom text-xl text-walnut-deep">
                  {sub.chu_han_nom || 'Chưa có dữ liệu'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Phiên âm Hán Việt
              </label>
              {editMode ? (
                <textarea
                  rows={2}
                  value={sub.phien_am_de_xuat}
                  onChange={(e) =>
                    setSub({ ...sub, phien_am_de_xuat: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm bg-white border border-limestone rounded"
                />
              ) : (
                <p className="text-ink">
                  {sub.phien_am_de_xuat || 'Chưa có dữ liệu'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Dịch nghĩa
              </label>
              {editMode ? (
                <textarea
                  rows={2}
                  value={sub.dich_nghia_de_xuat}
                  onChange={(e) =>
                    setSub({ ...sub, dich_nghia_de_xuat: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm bg-white border border-limestone rounded"
                />
              ) : (
                <p className="text-ink">
                  {sub.dich_nghia_de_xuat || 'Chưa có dữ liệu'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Giải thích nội dung / điển tích
              </label>
              {editMode ? (
                <textarea
                  rows={2}
                  value={sub.giai_thich_noi_dung || ''}
                  onChange={(e) =>
                    setSub({ ...sub, giai_thich_noi_dung: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded"
                />
              ) : (
                <p className="text-xs text-ink">
                  {sub.giai_thich_noi_dung || 'Chưa có ghi chú giải thích.'}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right 5 Cols: Decoupled Verification, Review Actions, Review History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Decoupled Status Overview */}
          <section className="border border-limestone bg-parchment/40 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-semibold text-walnut-deep">
              Tách biệt Duyệt công khai & Kiểm chứng học thuật
            </h3>
            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="p-3 rounded border border-limestone bg-ivory flex items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  Trạng thái duyệt công khai:
                </span>
                <ProcessingStatusBadge status={sub.trang_thai_xu_ly} />
              </div>
              <div className="p-3 rounded border border-limestone bg-ivory flex items-center justify-between gap-2">
                <span className="font-medium text-ink">
                  Mức kiểm chứng nội dung:
                </span>
                <VerificationBadge status={overallVerification} />
              </div>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Thao tác “Duyệt và công khai” chỉ đưa hồ sơ lên danh sách tra cứu công khai; không tự động đánh dấu phiên âm, dịch nghĩa hay nguồn tư liệu là “Đã kiểm chứng”.
            </p>
          </section>

          {/* Granular Verification Controls */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep">
              Đánh dấu mức kiểm chứng từng phần
            </h3>
            <div className="space-y-3">
              {GRANULAR_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-limestone/60"
                >
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-ink">
                      {field.label}
                    </span>
                    <VerificationBadge
                      status={sub.kiem_chung_chi_tiet[field.key]}
                    />
                  </div>
                  <select
                    value={sub.kiem_chung_chi_tiet[field.key]}
                    onChange={(e) =>
                      setSub({
                        ...sub,
                        kiem_chung_chi_tiet: {
                          ...sub.kiem_chung_chi_tiet,
                          [field.key]: e.target.value as VerificationLevel,
                        },
                      })
                    }
                    className="px-2.5 py-1.5 text-xs bg-white border border-limestone rounded"
                  >
                    <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                    <option value="da_kiem_chung">Đã kiểm chứng</option>
                    <option value="chua_doc_duoc">Chưa đọc được</option>
                  </select>
                </div>
              ))}

              <div className="pt-1">
                <label className="block text-xs font-semibold text-ink mb-1">
                  Mức kiểm chứng tổng thể của hồ sơ
                </label>
                <select
                  value={overallVerification}
                  onChange={(e) =>
                    setOverallVerification(e.target.value as VerificationLevel)
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded"
                >
                  <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                  <option value="da_kiem_chung">Đã kiểm chứng</option>
                  <option value="chua_doc_duoc">Chưa đọc được</option>
                </select>
              </div>
            </div>
          </section>

          {/* Decision Panel */}
          <section className="border border-limestone bg-parchment/60 rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-walnut-deep">
              Quyết định duyệt tư liệu
            </h3>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Ghi chú kiểm duyệt nội bộ
              </label>
              <textarea
                rows={2}
                value={sub.ghi_chu_kiem_duyet || ''}
                onChange={(e) =>
                  setSub({ ...sub, ghi_chu_kiem_duyet: e.target.value })
                }
                placeholder="Ghi chú nội bộ dành cho Ban quản trị..."
                className="w-full p-2.5 text-xs bg-white border border-limestone rounded"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Lý do duyệt / từ chối / yêu cầu bổ sung *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bắt buộc nhập lý do khi bấm Từ chối hoặc Yêu cầu bổ sung..."
                className="w-full p-2.5 text-xs bg-white border border-limestone rounded"
              />
            </div>

            <div className="space-y-2.5 pt-1">
              {currentUser.can_publish ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction('DUYET_VA_CONG_KHAI')}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-emerald-800 text-white rounded hover:bg-emerald-900 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Duyệt và công khai</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    runAction('XAC_NHAN_THONG_TIN', 'CHO_CONG_KHAI')
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-emerald-800 text-white rounded hover:bg-emerald-900 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Duyệt (Chuyển chờ ADMIN công khai)</span>
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction('TU_CHOI')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-red-800 text-white rounded hover:bg-red-900 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Từ chối</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction('YEU_CAU_BO_SUNG')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-amber-700 text-white rounded hover:bg-amber-800 disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Yêu cầu bổ sung</span>
                </button>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => runAction('LUU_BAN_NHAP')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold border border-walnut text-walnut-deep bg-ivory rounded hover:bg-parchment disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Lưu chỉnh sửa & mức kiểm chứng (chưa đổi trạng thái)</span>
              </button>

              {sub.official_identifier &&
                sub.trang_thai_xu_ly === 'DA_CONG_KHAI' && (
                  <a
                    href={`/tu-lieu/${encodeURIComponent(sub.official_identifier)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-bronze border border-limestone bg-ivory rounded hover:bg-parchment"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      Xem trang công khai ({sub.official_identifier})
                    </span>
                  </a>
                )}
            </div>
          </section>

          {/* Review History */}
          <section className="border border-limestone bg-ivory rounded-lg p-5 space-y-3">
            <h3 className="text-lg font-semibold text-walnut-deep border-b border-limestone pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-bronze" />
              <span>Lịch sử duyệt tư liệu</span>
            </h3>
            {!sub.lich_su_duyet || sub.lich_su_duyet.length === 0 ? (
              <p className="text-xs text-muted">
                Chưa có lượt duyệt nào cho hồ sơ này.
              </p>
            ) : (
              <div className="space-y-3">
                {[...sub.lich_su_duyet].reverse().map((entry, idx) => (
                  <div
                    key={`${entry.thoi_gian}-${idx}`}
                    className="p-3 rounded border border-limestone bg-parchment/30 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-walnut-deep">
                        {entry.nguoi_duyet} ({entry.tai_khoan} · {entry.vai_tro}
                        )
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {new Date(entry.thoi_gian).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-mono px-1.5 py-0.5 bg-white border border-limestone rounded">
                        {entry.trang_thai_truoc}
                      </span>
                      <span>→</span>
                      <span className="font-mono px-1.5 py-0.5 bg-white border border-limestone rounded font-semibold">
                        {entry.trang_thai_sau}
                      </span>
                    </div>
                    <p className="text-ink">
                      <span className="text-muted">Lý do: </span>
                      {entry.ly_do}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
