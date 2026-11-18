import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive } from 'lucide-react';
import { fetchSources } from '../../api/client.ts';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type { ArchiveSource } from '../../types/archive.ts';

const SOURCE_TYPES = [
  'Ảnh chụp tại di tích',
  'Ảnh do dòng họ cung cấp',
  'Tư liệu của Ban quản lý',
  'Sách nghiên cứu',
  'Tài liệu Hán Nôm',
  'Hồ sơ di tích',
  'Bài báo',
  'Tài liệu lưu trữ',
  'Nguồn khác',
];

export function NguonTuLieuPage() {
  const [sources, setSources] = useState<ArchiveSource[]>([]);
  const [recordLookup, setRecordLookup] = useState<
    Record<string, { identifier: string; title: string }>
  >({});
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchSources()
      .then((res) => {
        if (!mounted) return;
        setSources(res.sources);
        setRecordLookup(res.recordLookup);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Không thể tải danh mục nguồn tư liệu.');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSources = selectedType
    ? sources.filter((s) => s.loai_nguon === selectedType)
    : sources;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-limestone pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-walnut-deep">
            Nguồn tư liệu và ghi nhận
          </h1>
          <p className="text-sm text-muted mt-1.5 max-w-2xl">
            Theo dõi xuất xứ thu thập, đơn vị/người cung cấp và liên kết hai chiều giữa nguồn tài liệu với từng hồ sơ hoành phi, câu đối.
          </p>
        </div>

        <div className="shrink-0">
          <label className="sr-only" htmlFor="source-type-filter">
            Lọc theo loại nguồn
          </label>
          <select
            id="source-type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
          >
            <option value="">Tất cả loại nguồn</option>
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-900 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-32 border border-limestone bg-parchment/40 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="border border-limestone bg-parchment/50 rounded-lg p-12 text-center space-y-3">
          <Archive className="w-8 h-8 text-bronze mx-auto" />
          <p className="text-base font-medium text-walnut-deep">
            Chưa có thông tin nguồn tư liệu.
          </p>
          <p className="text-xs text-muted max-w-lg mx-auto">
            Hệ thống không tự tạo tên sách, tên tác giả hay tài liệu mẫu. Nguồn tư liệu sẽ hiển thị tại đây khi Ban quản lý nạp dữ liệu thật.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredSources.map((src) => (
            <article
              key={src.ma_nguon}
              className="border border-limestone bg-ivory rounded-lg p-6 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-limestone pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-mono font-semibold text-walnut-deep">
                      {src.ma_nguon}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{src.loai_nguon}</span>
                    {src.ngay_tiep_nhan && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Tiếp nhận: {src.ngay_tiep_nhan}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold text-walnut-deep">
                    {src.ten_nguon}
                  </h2>
                </div>
                <VerificationBadge status={src.tinh_trang_xac_minh} />
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Tác giả / Người cung cấp
                  </dt>
                  <dd className="text-ink mt-0.5">
                    {src.tac_gia_hoac_nguoi_cung_cap || 'Chưa có thông tin'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Địa điểm
                  </dt>
                  <dd className="text-ink mt-0.5">
                    {src.dia_diem || 'Chưa xác định'}
                  </dd>
                </div>
              </dl>

              {src.ghi_chu && (
                <p className="text-sm text-ink/90 bg-parchment/40 border border-limestone rounded p-3.5">
                  <span className="font-semibold text-muted mr-1.5">
                    Ghi chú:
                  </span>
                  {src.ghi_chu}
                </p>
              )}

              <div className="pt-2 border-t border-limestone/70">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Danh sách hồ sơ liên quan ({src.ho_so_lien_quan.length})
                </p>
                {src.ho_so_lien_quan.length === 0 ? (
                  <p className="text-xs text-muted">
                    Chưa liên kết với hồ sơ công bố nào.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {src.ho_so_lien_quan.map((recId) => {
                      const info = recordLookup[recId];
                      return (
                        <Link
                          key={recId}
                          to={`/tu-lieu/${encodeURIComponent(recId)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-limestone bg-parchment/50 rounded hover:border-bronze text-walnut-deep transition-colors"
                        >
                          <span className="font-mono font-semibold">
                            {recId}
                          </span>
                          {info?.title && <span>— {info.title}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
