import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  X,
} from 'lucide-react';
import { submitCitizenContribution } from '../api/client.ts';
import type { CitizenSubmissionInput } from '../types/archive.ts';

interface SubmissionModalProps {
  open: boolean;
  onClose: () => void;
  targetRecord?: {
    identifier: string;
    title: string;
    noi_luu_giu_hien_nay: string;
  };
}

const INITIAL_FORM: CitizenSubmissionInput = {
  ten_tu_lieu: '',
  loai_tu_lieu: 'Hoành phi',
  noi_luu_giu: '',
  loai_dia_diem: 'Đình',
  dia_danh_hien_nay: '',
  dia_danh_lich_su: '',
  thon_lang: '',
  dong_ho_hoac_gia_dinh: '',
  chu_han_nom: '',
  phien_am_de_xuat: '',
  dich_nghia_de_xuat: '',
  nien_dai_de_xuat: '',
  nguoi_cung_cap: '',
  lien_he: '',
  nguon_xac_minh: '',
  nguon_anh: '',
  nguoi_cho_phep_cong_bo: '',
  pham_vi_su_dung: '',
  xac_nhan_quyen_cong_bo: false,
  loai_dong_gop: 'ho_so_moi',
  ghi_chu: '',
};

export function SubmissionModal({
  open,
  onClose,
  targetRecord,
}: SubmissionModalProps) {
  const [form, setForm] = useState<CitizenSubmissionInput>(INITIAL_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    id: string;
    message: string;
    trang_thai_xu_ly: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (open && targetRecord) {
      setForm({
        ...INITIAL_FORM,
        ten_tu_lieu: targetRecord.title,
        noi_luu_giu: targetRecord.noi_luu_giu_hien_nay,
        target_identifier: targetRecord.identifier,
        loai_dong_gop: 'bo_sung_chinh_sua',
      });
    } else if (open && !targetRecord) {
      setForm(INITIAL_FORM);
    }
    setFiles([]);
    setError('');
    setResult(null);
  }, [open, targetRecord]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const res = await submitCitizenContribution(form, files);
      setResult({
        id: res.id,
        message: res.message,
        trang_thai_xu_ly: res.trang_thai_xu_ly,
      });
      setForm(INITIAL_FORM);
      setFiles([]);
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(
        serverMsg || 'Không thể gửi phiếu đề xuất lúc này. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!result?.id) return;
    try {
      await navigator.clipboard.writeText(result.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-walnut-deep/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-modal-title"
    >
      <div className="bg-ivory border border-limestone rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-limestone bg-parchment">
          <div>
            <h2
              id="submission-modal-title"
              className="text-2xl font-semibold text-walnut-deep"
            >
              {targetRecord
                ? `Đề nghị bổ sung / chỉnh sửa (${targetRecord.identifier})`
                : 'Đóng góp thông tin tư liệu mới'}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Thông tin và hình ảnh gửi lên sẽ lưu vào hàng chờ duyệt (PENDING), chưa công khai cho tới khi người kiểm duyệt xác minh.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng biểu mẫu"
            className="p-2 rounded text-muted hover:text-ink hover:bg-ivory transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded border border-red-200 bg-red-50 text-red-900 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded border border-emerald-200 bg-emerald-50 text-emerald-950 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{result.message}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200">
                <div className="text-xs">
                  <span>Mã tiếp nhận: </span>
                  <span className="font-mono font-bold text-sm">
                    {result.id}
                  </span>
                  <span className="ml-2 text-emerald-800">
                    · Trạng thái: {result.trang_thai_xu_ly}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-emerald-300 rounded hover:bg-emerald-100"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép mã</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Tên tư liệu *
              </label>
              <input
                type="text"
                required
                value={form.ten_tu_lieu}
                onChange={(e) =>
                  setForm({ ...form, ten_tu_lieu: e.target.value })
                }
                placeholder="Ví dụ: Hoành phi đại tự..."
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Loại tư liệu
              </label>
              <select
                value={form.loai_tu_lieu}
                onChange={(e) =>
                  setForm({ ...form, loai_tu_lieu: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              >
                <option value="Hoành phi">Hoành phi</option>
                <option value="Câu đối">Câu đối</option>
                <option value="Tư liệu khác">Tư liệu Hán Nôm liên quan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Nơi lưu giữ hiện nay *
              </label>
              <input
                type="text"
                required
                value={form.noi_luu_giu}
                onChange={(e) =>
                  setForm({ ...form, noi_luu_giu: e.target.value })
                }
                placeholder="Tên đình, chùa, đền, nhà thờ họ..."
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Loại địa điểm
              </label>
              <select
                value={form.loai_dia_diem}
                onChange={(e) =>
                  setForm({ ...form, loai_dia_diem: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              >
                <option value="Đình">Đình</option>
                <option value="Chùa">Chùa</option>
                <option value="Đền">Đền</option>
                <option value="Miếu">Miếu</option>
                <option value="Nhà thờ họ">Nhà thờ họ</option>
                <option value="Từ đường">Từ đường</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Địa danh hành chính hiện nay
              </label>
              <input
                type="text"
                value={form.dia_danh_hien_nay}
                onChange={(e) =>
                  setForm({ ...form, dia_danh_hien_nay: e.target.value })
                }
                placeholder="Phường/Xã, Quận/Huyện, Hà Nội"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Địa danh lịch sử (nếu có căn cứ)
              </label>
              <input
                type="text"
                value={form.dia_danh_lich_su}
                onChange={(e) =>
                  setForm({ ...form, dia_danh_lich_su: e.target.value })
                }
                placeholder="Tên phủ/huyện/tổng/xã cũ"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Thôn / Làng / Tổ dân phố
              </label>
              <input
                type="text"
                value={form.thon_lang}
                onChange={(e) =>
                  setForm({ ...form, thon_lang: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Dòng họ / Gia đình liên quan
              </label>
              <input
                type="text"
                value={form.dong_ho_hoac_gia_dinh}
                onChange={(e) =>
                  setForm({ ...form, dong_ho_hoac_gia_dinh: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Chữ Hán / Nôm (nếu biết)
              </label>
              <textarea
                rows={2}
                value={form.chu_han_nom}
                onChange={(e) =>
                  setForm({ ...form, chu_han_nom: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-hannom bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Phiên âm đề xuất
              </label>
              <textarea
                rows={2}
                value={form.phien_am_de_xuat}
                onChange={(e) =>
                  setForm({ ...form, phien_am_de_xuat: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Dịch nghĩa (nếu có)
              </label>
              <input
                type="text"
                value={form.dich_nghia_de_xuat || ''}
                onChange={(e) =>
                  setForm({ ...form, dich_nghia_de_xuat: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Niên đại (nếu có căn cứ)
              </label>
              <input
                type="text"
                value={form.nien_dai_de_xuat || ''}
                onChange={(e) =>
                  setForm({ ...form, nien_dai_de_xuat: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
          </div>

          {/* Image Attachment & Publication Permission Info */}
          <div className="p-4 rounded border border-limestone bg-parchment/40 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-walnut-deep flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-bronze" />
                <span>Đính kèm ảnh tư liệu (tối đa 5 ảnh JPG/PNG/WEBP)</span>
              </label>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) =>
                setFiles(Array.from(e.target.files || []).slice(0, 5))
              }
              className="block w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-limestone file:text-xs file:font-medium file:bg-ivory file:text-walnut-deep hover:file:bg-parchment"
            />
            {files.length > 0 && (
              <p className="text-xs text-muted">
                Đã chọn {files.length} tệp: {files.map((f) => f.name).join(', ')}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-limestone/70">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Nguồn ảnh
                </label>
                <input
                  type="text"
                  value={form.nguon_anh || ''}
                  onChange={(e) =>
                    setForm({ ...form, nguon_anh: e.target.value })
                  }
                  placeholder="Ảnh tự chụp tại di tích / ảnh dòng họ..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-limestone rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Người có quyền cho phép công bố
                </label>
                <input
                  type="text"
                  value={form.nguoi_cho_phep_cong_bo || ''}
                  onChange={(e) =>
                    setForm({ ...form, nguoi_cho_phep_cong_bo: e.target.value })
                  }
                  placeholder="Ban quản lý / Đại diện dòng họ..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-limestone rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Phạm vi được phép sử dụng
                </label>
                <input
                  type="text"
                  value={form.pham_vi_su_dung || ''}
                  onChange={(e) =>
                    setForm({ ...form, pham_vi_su_dung: e.target.value })
                  }
                  placeholder="Công khai phục vụ nghiên cứu, lưu trữ..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-limestone rounded"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink pt-4">
                <input
                  type="checkbox"
                  checked={Boolean(form.xac_nhan_quyen_cong_bo)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      xac_nhan_quyen_cong_bo: e.target.checked,
                    })
                  }
                />
                <span>Đã được Ban quản lý / chủ sở hữu đồng ý công bố</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Người cung cấp / Đơn vị *
              </label>
              <input
                type="text"
                required
                value={form.nguoi_cung_cap}
                onChange={(e) =>
                  setForm({ ...form, nguoi_cung_cap: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Thông tin liên hệ (lưu nội bộ, không công khai)
              </label>
              <input
                type="text"
                value={form.lien_he}
                onChange={(e) => setForm({ ...form, lien_he: e.target.value })}
                placeholder="Email hoặc số điện thoại"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Nguồn tư liệu & căn cứ xác minh *
            </label>
            <input
              type="text"
              required
              value={form.nguon_xac_minh}
              onChange={(e) =>
                setForm({ ...form, nguon_xac_minh: e.target.value })
              }
              placeholder="Ví dụ: Ảnh chụp thực địa, Gia phả dòng họ, Hồ sơ di tích..."
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Ghi chú bổ sung
            </label>
            <textarea
              rows={2}
              value={form.ghi_chu}
              onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-limestone">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-ink border border-limestone rounded hover:bg-parchment transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Đang ghi nhận...' : 'Gửi đề xuất chờ xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
