import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { lookupSubmission, submitSupplement } from '../api/client.ts';
import { ProcessingStatusBadge } from './ProcessingStatusBadge.tsx';
import type { ProcessingStatus } from '../types/archive.ts';

interface SubmissionLookupModalProps {
  open: boolean;
  onClose: () => void;
}

export function SubmissionLookupModal({
  open,
  onClose,
}: SubmissionLookupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<{
    submission_id: string;
    ten_tu_lieu: string;
    loai_tu_lieu: string;
    noi_luu_giu: string;
    ngay_gui: string;
    ngay_cap_nhat: string;
    trang_thai_xu_ly: ProcessingStatus;
    ly_do_xu_ly: string;
    official_identifier?: string;
  } | null>(null);

  const [extraText, setExtraText] = useState('');
  const [extraSource, setExtraSource] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [supMessage, setSupMessage] = useState('');

  if (!open) return null;

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setFound(null);
    setSupMessage('');
    try {
      const res = await lookupSubmission(code.trim());
      setFound(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không tìm thấy hồ sơ với mã tiếp nhận này.');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplement = async (e: FormEvent) => {
    e.preventDefault();
    if (!found) return;
    setSupSubmitting(true);
    setError('');
    setSupMessage('');
    try {
      const res = await submitSupplement(
        found.submission_id,
        extraText,
        extraSource,
        extraFiles
      );
      setSupMessage(res.message);
      setFound({ ...found, trang_thai_xu_ly: res.trang_thai_xu_ly });
      setExtraText('');
      setExtraSource('');
      setExtraFiles([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể gửi thông tin bổ sung.');
    } finally {
      setSupSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-walnut-deep/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookup-modal-title"
    >
      <div className="bg-ivory border border-limestone rounded-lg max-w-xl w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-limestone bg-parchment">
          <h2
            id="lookup-modal-title"
            className="text-xl font-semibold text-walnut-deep"
          >
            Tra cứu tình trạng hồ sơ đã gửi
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tra cứu"
            className="p-1.5 rounded text-muted hover:text-ink hover:bg-ivory"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Nhập mã tiếp nhận (ví dụ: TN-20261118-A1B2)"
              className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Đang tìm...' : 'Tra cứu'}</span>
            </button>
          </form>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-900 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {supMessage && (
            <div className="flex items-start gap-2 p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{supMessage}</span>
            </div>
          )}

          {found && (
            <div className="border border-limestone bg-parchment/40 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-semibold text-walnut-deep">
                  {found.submission_id}
                </span>
                <ProcessingStatusBadge status={found.trang_thai_xu_ly} />
              </div>

              <div className="space-y-1 text-xs">
                <p>
                  <span className="text-muted">Tên tư liệu: </span>
                  <span className="font-medium text-ink">{found.ten_tu_lieu}</span>
                </p>
                <p>
                  <span className="text-muted">Nơi lưu giữ: </span>
                  <span className="text-ink">{found.noi_luu_giu}</span>
                </p>
                <p>
                  <span className="text-muted">Cập nhật lần cuối: </span>
                  <span className="font-mono text-ink">
                    {new Date(found.ngay_cap_nhat).toLocaleString('vi-VN')}
                  </span>
                </p>
              </div>

              {found.ly_do_xu_ly && (
                <div className="p-3 rounded border border-limestone bg-ivory text-xs">
                  <span className="font-semibold text-walnut-deep">
                    Phản hồi của Ban kiểm duyệt:{' '}
                  </span>
                  <span>{found.ly_do_xu_ly}</span>
                </div>
              )}

              {found.official_identifier && (
                <div className="pt-1">
                  <Link
                    to={`/tu-lieu/${encodeURIComponent(found.official_identifier)}`}
                    onClick={onClose}
                    className="text-xs font-semibold text-bronze hover:underline"
                  >
                    Xem hồ sơ đã công khai ({found.official_identifier})
                  </Link>
                </div>
              )}

              {found.trang_thai_xu_ly === 'CAN_BO_SUNG' && (
                <form
                  onSubmit={handleSupplement}
                  className="pt-3 border-t border-limestone space-y-3"
                >
                  <p className="text-xs font-semibold text-walnut-deep">
                    Gửi thông tin bổ sung theo yêu cầu:
                  </p>
                  <textarea
                    rows={3}
                    value={extraText}
                    onChange={(e) => setExtraText(e.target.value)}
                    placeholder="Nhập thông tin bổ sung, địa danh, nguồn xác minh..."
                    className="w-full p-2.5 text-xs bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={extraSource}
                    onChange={(e) => setExtraSource(e.target.value)}
                    placeholder="Nguồn bổ sung (nếu có)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-limestone rounded"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) =>
                      setExtraFiles(Array.from(e.target.files || []).slice(0, 5))
                    }
                    className="block w-full text-xs text-muted"
                  />
                  <button
                    type="submit"
                    disabled={supSubmitting}
                    className="px-4 py-2 text-xs font-semibold bg-bronze text-ivory rounded hover:bg-walnut disabled:opacity-50"
                  >
                    {supSubmitting ? 'Đang gửi...' : 'Gửi thông tin bổ sung'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
