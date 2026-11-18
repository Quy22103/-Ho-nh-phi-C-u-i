import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Filter,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { fetchRecords } from '../../api/client.ts';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type { FilterQuery, PublicRecord } from '../../types/archive.ts';

const PAGE_LIMIT = 12;

export function DanhSachPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [items, setItems] = useState<PublicRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{
    huyenLichSu: string[];
    xaHienNay: string[];
    xaLichSu: string[];
    thonLang: string[];
  }>({ huyenLichSu: [], xaHienNay: [], xaLichSu: [], thonLang: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const currentQuery: FilterQuery = {
    q: searchParams.get('q') || '',
    type: searchParams.get('type') || '',
    locationType: searchParams.get('locationType') || '',
    thanhPho: searchParams.get('thanhPho') || '',
    huyenLichSu: searchParams.get('huyenLichSu') || '',
    xaHienNay: searchParams.get('xaHienNay') || '',
    xaLichSu: searchParams.get('xaLichSu') || '',
    thonLang: searchParams.get('thonLang') || '',
    dongHo: searchParams.get('dongHo') || '',
    nhaThoHo: searchParams.get('nhaThoHo') || '',
    giaDinh: searchParams.get('giaDinh') || '',
    verification: searchParams.get('verification') || '',
    edition: searchParams.get('edition') || '',
    condition: searchParams.get('condition') || '',
    page: Number(searchParams.get('page')) || 1,
    limit: PAGE_LIMIT,
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    fetchRecords(currentQuery)
      .then((res) => {
        if (mounted) {
          setItems(res.items);
          setTotal(res.total);
          setFacets(res.facets);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Không thể tải danh sách hồ sơ tư liệu.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const updateParam = (key: keyof FilterQuery, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const currentPage = currentQuery.page || 1;

  const hasActiveFilters = Array.from(searchParams.entries()).some(
    ([k, v]) => k !== 'page' && v.trim() !== ''
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-limestone pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-walnut-deep">
            Danh sách và tra cứu tư liệu
          </h1>
          <p className="text-sm text-muted mt-1.5">
            Kết hợp nhiều bộ lọc theo loại tư liệu, địa điểm, địa danh hiện hành/lịch sử, dòng họ và mức kiểm chứng.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFiltersMobile((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-limestone rounded bg-ivory hover:bg-parchment"
          >
            <Filter className="w-4 h-4" />
            <span>Bộ lọc</span>
          </button>
          <div className="inline-flex rounded border border-limestone bg-parchment/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              aria-label="Hiển thị dạng thẻ"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'card'
                  ? 'bg-ivory text-walnut-deep shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dạng thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Hiển thị dạng bảng"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-ivory text-walnut-deep shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dạng bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Filter Sidebar + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filter Sidebar */}
        <aside
          className={`lg:col-span-4 xl:col-span-3 border border-limestone bg-parchment/40 rounded-lg p-5 space-y-5 ${
            showFiltersMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-limestone pb-3">
            <h2 className="text-lg font-semibold text-walnut-deep">
              Bộ lọc tư liệu
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>

          {/* Keyword */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Từ khóa tìm kiếm
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={currentQuery.q || ''}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder="Tên, Hán/Nôm, phiên âm, mã..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
          </div>

          {/* 1. Loại tư liệu */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              1. Loại tư liệu
            </label>
            <select
              value={currentQuery.type || ''}
              onChange={(e) => updateParam('type', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            >
              <option value="">Tất cả loại tư liệu</option>
              <option value="Hoành phi">Hoành phi</option>
              <option value="Câu đối">Câu đối</option>
              <option value="Tư liệu khác">Tư liệu khác</option>
            </select>
          </div>

          {/* 2. Địa điểm lưu giữ */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              2. Địa điểm lưu giữ
            </label>
            <select
              value={currentQuery.locationType || ''}
              onChange={(e) => updateParam('locationType', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            >
              <option value="">Tất cả loại địa điểm</option>
              <option value="Đình">Đình</option>
              <option value="Chùa">Chùa</option>
              <option value="Đền">Đền</option>
              <option value="Miếu">Miếu</option>
              <option value="den_mieu">Đền, Miếu</option>
              <option value="Nhà thờ họ">Nhà thờ họ</option>
              <option value="Từ đường">Từ đường</option>
              <option value="nha_tho_ho_tu_duong">Nhà thờ họ, Từ đường</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          {/* 3. Địa bàn */}
          <div className="space-y-2.5 pt-2 border-t border-limestone">
            <p className="text-xs font-semibold text-ink">
              3. Địa bàn (hiện hành & lịch sử)
            </p>
            <input
              type="text"
              value={currentQuery.thanhPho || ''}
              onChange={(e) => updateParam('thanhPho', e.target.value)}
              placeholder="Thành phố (mặc định Hà Nội)"
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <input
              type="text"
              list="huyen-lich-su-list"
              value={currentQuery.huyenLichSu || ''}
              onChange={(e) => updateParam('huyenLichSu', e.target.value)}
              placeholder="Quận/huyện/thị xã (địa danh lịch sử)"
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <datalist id="huyen-lich-su-list">
              {facets.huyenLichSu.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <input
              type="text"
              list="xa-hien-nay-list"
              value={currentQuery.xaHienNay || ''}
              onChange={(e) => updateParam('xaHienNay', e.target.value)}
              placeholder="Phường/xã (địa danh hiện hành)"
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <datalist id="xa-hien-nay-list">
              {facets.xaHienNay.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <input
              type="text"
              list="xa-lich-su-list"
              value={currentQuery.xaLichSu || ''}
              onChange={(e) => updateParam('xaLichSu', e.target.value)}
              placeholder="Phường/xã (địa danh lịch sử)"
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <datalist id="xa-lich-su-list">
              {facets.xaLichSu.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <input
              type="text"
              list="thon-lang-list"
              value={currentQuery.thonLang || ''}
              onChange={(e) => updateParam('thonLang', e.target.value)}
              placeholder="Thôn / Làng / Tổ dân phố"
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <datalist id="thon-lang-list">
              {facets.thonLang.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          {/* 4. Dòng họ */}
          <div className="space-y-2.5 pt-2 border-t border-limestone">
            <p className="text-xs font-semibold text-ink">4. Dòng họ & gia đình</p>
            <input
              type="text"
              value={currentQuery.dongHo || ''}
              onChange={(e) => updateParam('dongHo', e.target.value)}
              placeholder="Tên dòng họ..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <input
              type="text"
              value={currentQuery.nhaThoHo || ''}
              onChange={(e) => updateParam('nhaThoHo', e.target.value)}
              placeholder="Tên nhà thờ họ..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
            <input
              type="text"
              value={currentQuery.giaDinh || ''}
              onChange={(e) => updateParam('giaDinh', e.target.value)}
              placeholder="Tên gia đình liên quan..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
          </div>

          {/* 5. Mức kiểm chứng */}
          <div className="pt-2 border-t border-limestone">
            <label className="block text-xs font-semibold text-ink mb-1.5">
              5. Mức kiểm chứng
            </label>
            <select
              value={currentQuery.verification || ''}
              onChange={(e) => updateParam('verification', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="da_kiem_chung">Đã kiểm chứng</option>
              <option value="chua_kiem_chung">Chưa kiểm chứng</option>
              <option value="chua_doc_duoc">Chưa đọc được</option>
            </select>
          </div>

          {/* 6. Loại bản đang hiển thị */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              6. Loại bản đang hiển thị
            </label>
            <select
              value={currentQuery.edition || ''}
              onChange={(e) => updateParam('edition', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            >
              <option value="">Tất cả loại bản</option>
              <option value="Ảnh bản gốc">Ảnh bản gốc</option>
              <option value="Ảnh bản dập">Ảnh bản dập</option>
              <option value="Bản sao">Bản sao</option>
              <option value="Bản phục chế">Bản phục chế</option>
              <option value="Bản phiên âm">Bản phiên âm</option>
              <option value="Bản dịch">Bản dịch</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          {/* 7. Tình trạng bản gốc */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              7. Tình trạng bản gốc
            </label>
            <select
              value={currentQuery.condition || ''}
              onChange={(e) => updateParam('condition', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            >
              <option value="">Tất cả tình trạng</option>
              <option value="Còn nguyên vẹn">Còn nguyên vẹn</option>
              <option value="Hư hỏng">Hư hỏng</option>
              <option value="Mất một phần">Mất một phần</option>
              <option value="Không xác định">Không xác định</option>
            </select>
          </div>
        </aside>

        {/* Results Column */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>
              Tìm thấy{' '}
              <span className="font-mono font-semibold tabular-nums text-walnut-deep">
                {total}
              </span>{' '}
              hồ sơ tư liệu
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-limestone rounded bg-ivory hover:bg-parchment text-ink"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa tất cả bộ lọc</span>
              </button>
            )}
          </div>

          {error && (
            <div className="p-4 rounded border border-red-200 bg-red-50 text-red-900 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="border border-limestone bg-parchment/30 rounded-lg p-5 h-56 animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="border border-limestone bg-parchment/50 rounded-lg p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-bronze mx-auto" />
              <p className="text-base font-medium text-walnut-deep">
                Không tìm thấy hồ sơ phù hợp. Hiện chưa có tư liệu trong cơ sở dữ liệu đáp ứng điều kiện tìm kiếm.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-xs font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep transition-colors"
                >
                  Xóa bộ lọc để xem lại
                </button>
              )}
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {items.map((rec) => {
                const thumb = rec.images[0]?.thumbnail_url;
                const addressParts = [
                  rec.coverage.thon_lang,
                  rec.coverage.phuong_xa_hien_nay ||
                    rec.coverage.phuong_xa_lich_su,
                  rec.coverage.don_vi_hanh_chinh_hien_nay ||
                    rec.coverage.don_vi_hanh_chinh_lich_su,
                  rec.coverage.thanh_pho,
                ].filter(Boolean);

                return (
                  <article
                    key={rec.identifier}
                    className="border border-limestone bg-ivory rounded-lg overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-44 bg-parchment/70 border-b border-limestone flex items-center justify-center overflow-hidden">
                        {rec.image_publication_allowed && thumb ? (
                          <img
                            src={thumb}
                            alt={rec.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="px-6 text-center text-xs text-muted flex flex-col items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-bronze/70" />
                            <span>
                              Hình ảnh chờ xác nhận quyền công bố
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                          <span className="font-mono tabular-nums">
                            {rec.identifier}
                          </span>
                          <span>{rec.type || 'Chưa phân loại'}</span>
                        </div>

                        <h3 className="text-xl font-semibold text-walnut-deep leading-snug">
                          {rec.title || 'Chưa có tên tư liệu'}
                        </h3>

                        {rec.chu_han_nom && (
                          <p
                            lang="zh-Hant"
                            className="font-hannom text-lg text-walnut tracking-wider"
                          >
                            {rec.chu_han_nom}
                          </p>
                        )}

                        <dl className="text-xs text-ink/90 space-y-1 pt-1">
                          <div>
                            <dt className="inline text-muted">Nơi lưu giữ: </dt>
                            <dd className="inline font-medium">
                              {rec.noi_luu_giu_hien_nay || 'Chưa xác định'}
                            </dd>
                          </div>
                          {addressParts.length > 0 && (
                            <div>
                              <dt className="inline text-muted">Địa danh: </dt>
                              <dd className="inline">{addressParts.join(', ')}</dd>
                            </div>
                          )}
                          {(rec.dong_ho_lien_quan || rec.gia_dinh_lien_quan) && (
                            <div>
                              <dt className="inline text-muted">Dòng họ / Gia đình: </dt>
                              <dd className="inline">
                                {[rec.dong_ho_lien_quan, rec.gia_dinh_lien_quan]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    <div className="px-5 py-3.5 bg-parchment/40 border-t border-limestone flex items-center justify-between gap-3">
                      <VerificationBadge status={rec.muc_kiem_chung} />
                      <Link
                        to={`/tu-lieu/${encodeURIComponent(rec.identifier)}`}
                        className="text-xs font-semibold text-bronze hover:underline whitespace-nowrap"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border border-limestone bg-ivory rounded-lg overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-parchment border-b border-limestone text-xs uppercase tracking-wider text-muted">
                    <th className="py-3 px-4 font-semibold">Mã hồ sơ</th>
                    <th className="py-3 px-4 font-semibold">Tên tư liệu</th>
                    <th className="py-3 px-4 font-semibold">Loại</th>
                    <th className="py-3 px-4 font-semibold">Nơi lưu giữ</th>
                    <th className="py-3 px-4 font-semibold">Kiểm chứng</th>
                    <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-limestone">
                  {items.map((rec) => (
                    <tr key={rec.identifier} className="hover:bg-parchment/30">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {rec.identifier}
                      </td>
                      <td className="py-3 px-4 font-medium text-walnut-deep">
                        {rec.title}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                        {rec.type || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {rec.noi_luu_giu_hien_nay || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <VerificationBadge status={rec.muc_kiem_chung} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/tu-lieu/${encodeURIComponent(rec.identifier)}`}
                          className="text-xs font-semibold text-bronze hover:underline"
                        >
                          Xem chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_LIMIT && (
            <div className="flex items-center justify-between pt-4 border-t border-limestone text-xs">
              <span className="text-muted">
                Trang{' '}
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {currentPage}
                </span>{' '}
                / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => updateParam('page', String(currentPage - 1))}
                  className="px-3 py-1.5 border border-limestone rounded bg-ivory hover:bg-parchment disabled:opacity-40"
                >
                  Trang trước
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateParam('page', String(currentPage + 1))}
                  className="px-3 py-1.5 border border-limestone rounded bg-ivory hover:bg-parchment disabled:opacity-40"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
