import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { submitCitizenContribution } from '../api/client.ts';
import type { CitizenSubmissionInput } from '../types/archive.ts';

interface SubmissionModalProps {
  open: boolean;
  onClose: () => void;
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
  nguoi_cung_cap: '',
  lien_he: '',
  nguon_xac_minh: '',
  ghi_chu: '',
};

export function SubmissionModal({ open, onClose }: SubmissionModalProps) {
  const [form, setForm] = useState<CitizenSubmissionInput>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await submitCitizenContribution(form);
      setSuccessMsg(`${res.message} (Mã tiếp nhận: ${res.id})`);
      setForm(INITIAL_FORM);
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
              Đóng góp thông tin tư liệu
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Phiếu tiếp nhận dành cho người dân và Ban quản lý di tích, dòng họ (chờ kiểm chứng trước khi đưa vào hồ sơ chính thức).
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
          {successMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
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
                Thông tin liên hệ (chỉ lưu nội bộ)
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
              {submitting ? 'Đang ghi nhận...' : 'Gửi đề xuất chờ kiểm chứng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
