import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Compass, Search } from 'lucide-react';
import { fetchStats } from '../../api/client.ts';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type { ArchiveStats } from '../../types/archive.ts';

const CATEGORIES = [
  {
    title: 'Hoành phi',
    subtitle: 'Bức đại tự khắc chữ Hán/Nôm treo chính điện, gian thờ',
    to: '/danh-sach?type=Ho%C3%A0nh+phi',
  },
  {
    title: 'Câu đối',
    subtitle: 'Đôi vế đối chữ Hán/Nôm khắc gỗ, đắp vữa, sơn thếp',
    to: '/danh-sach?type=C%C3%A2u+%C4%91%E1%BB%91i',
  },
  {
    title: 'Tư liệu tại đình',
    subtitle: 'Hoành phi, câu đối lưu giữ tại đình làng Hà Nội',
    to: '/danh-sach?locationType=%C4%90%C3%ACnh',
  },
  {
    title: 'Tư liệu tại chùa',
    subtitle: 'Tư liệu Hán Nôm tại các cơ sở thờ tự Phật giáo',
    to: '/danh-sach?locationType=Ch%C3%B9a',
  },
  {
    title: 'Tư liệu tại đền, miếu',
    subtitle: 'Hoành phi, câu đối tại đền thờ, miếu cổ trên địa bàn',
    to: '/danh-sach?locationType=den_mieu',
  },
  {
    title: 'Tư liệu tại nhà thờ họ, từ đường',
    subtitle: 'Di sản chữ viết gia tộc và không gian thờ tổ tiên',
    to: '/danh-sach?locationType=nha_tho_ho_tu_duong',
  },
];

export function HomePage() {
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchStats()
      .then((res) => {
        if (mounted) {
          setStats(res.stats);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Không thể tải số liệu thống kê từ cơ sở dữ liệu.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/danh-sach?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/danh-sach');
    }
  };

  const statCards = [
    { label: 'Tổng số hồ sơ', value: stats?.tong_ho_so ?? 0 },
    { label: 'Số lượng hoành phi', value: stats?.so_hoanh_phi ?? 0 },
    { label: 'Số lượng câu đối', value: stats?.so_cau_doi ?? 0 },
    { label: 'Số địa điểm lưu giữ', value: stats?.so_dia_diem_luu_giu ?? 0 },
    { label: 'Số dòng họ', value: stats?.so_dong_ho ?? 0 },
    { label: 'Số di tích', value: stats?.so_di_tich ?? 0 },
    { label: 'Hồ sơ đã kiểm chứng', value: stats?.so_da_kiem_chung ?? 0 },
    { label: 'Hồ sơ chưa kiểm chứng', value: stats?.so_chua_kiem_chung ?? 0 },
  ];

  return (
    <div className="space-y-16 pb-8">
      {/* Editorial Archival Banner */}
      <section className="border-b border-limestone bg-parchment/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-8 space-y-6">
              <p className="text-xs font-medium tracking-widest uppercase text-bronze">
                Thư viện số di sản văn hóa thành phố Hà Nội
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold text-walnut-deep leading-[1.15] text-balance">
                LƯU GIỮ GIÁ TRỊ HOÀNH PHI – CÂU ĐỐI HÀ NỘI
              </h1>
              <p className="text-base sm:text-lg font-serif text-ink/90 max-w-2xl leading-relaxed">
                Hệ thống hồ sơ số tập hợp hình ảnh, chữ Hán/Nôm, phiên âm và thông tin kiểm chứng về hoành phi, câu đối tại đình, chùa, đền và nhà thờ họ trên địa bàn thành phố Hà Nội.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/danh-sach"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>Khám phá tư liệu</span>
                </Link>
                <Link
                  to="/hoi-dap"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold border border-walnut text-walnut-deep bg-ivory rounded hover:bg-parchment transition-colors whitespace-nowrap"
                >
                  <Compass className="w-4 h-4" aria-hidden="true" />
                  <span>Tra cứu ngay</span>
                </Link>
              </div>
            </div>

            {/* Neutral Graphic Typographic Plaque (No AI artifact image) */}
            <div className="lg:col-span-4 border border-limestone bg-ivory rounded-lg p-6 flex flex-col justify-between">
              <div className="border border-limestone/80 rounded p-6 flex-1 flex flex-col items-center justify-center text-center bg-parchment/30">
                <p
                  lang="zh-Hant"
                  className="font-hannom text-4xl sm:text-5xl tracking-[0.25em] text-walnut-deep mb-4"
                >
                  河內遺產
                </p>
                <div className="w-16 h-px bg-bronze/50 mb-4" />
                <p className="text-xs text-muted leading-relaxed max-w-xs">
                  Lưu trữ nguyên trạng tư liệu Hán Nôm, phân tách rõ địa danh lịch sử và hiện hành, tôn trọng tuyệt đối quyền công bố của Ban quản lý và dòng họ.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-limestone flex items-center justify-between text-xs text-muted">
                <span>Chuẩn dữ liệu Dublin Core</span>
                <span>Kiểm chứng độc lập</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Large Search Bar */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <form
          onSubmit={handleSearch}
          className="bg-ivory border border-limestone rounded-lg p-4 sm:p-5 shadow-sm"
        >
          <label
            htmlFor="home-search-input"
            className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2"
          >
            Tìm kiếm nhanh trong cơ sở dữ liệu
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-5 h-5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="home-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên hoành phi, nội dung câu đối, chữ Hán/Nôm, phiên âm, đình/chùa/nhà thờ họ, dòng họ, địa danh hoặc mã hồ sơ..."
                className="w-full pl-11 pr-4 py-3 text-sm sm:text-base bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 text-sm font-semibold bg-bronze text-ivory rounded hover:bg-walnut transition-colors whitespace-nowrap shrink-0"
            >
              Tìm kiếm tư liệu
            </button>
          </div>
          <p className="text-xs text-muted mt-2.5">
            Hỗ trợ tìm theo tên hoành phi, nội dung câu đối, chữ Hán/Nôm, phiên âm, dịch nghĩa, tên di tích, dòng họ, gia đình, địa danh lịch sử/hiện hành và mã hồ sơ.
          </p>
        </form>
      </section>

      {/* Category Groups */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-limestone pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-walnut-deep">
              Danh mục tư liệu
            </h2>
            <p className="text-sm text-muted mt-1">
              Phân nhóm theo loại hình hiện vật và không gian thờ tự tại Hà Nội
            </p>
          </div>
          <Link
            to="/danh-sach"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-bronze hover:underline whitespace-nowrap"
          >
            <span>Xem toàn bộ danh sách</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.title}
              to={cat.to}
              className="group border border-limestone bg-ivory rounded-lg p-6 hover:bg-parchment/70 hover:border-bronze/60 transition-colors flex flex-col justify-between"
            >
              <div>
                <h3 className="text-xl font-semibold text-walnut-deep group-hover:text-bronze transition-colors">
                  {cat.title}
                </h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  {cat.subtitle}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-limestone/70 flex items-center justify-between text-xs font-medium text-bronze">
                <span>Tra cứu nhóm này</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Statistics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="border-b border-limestone pb-4">
          <h2 className="text-2xl sm:text-3xl font-semibold text-walnut-deep">
            Thống kê tư liệu thực tế
          </h2>
          <p className="text-sm text-muted mt-1">
            Số liệu tổng hợp trực tiếp từ tệp dữ liệu gốc của hệ thống
          </p>
        </div>

        {error ? (
          <div className="p-4 rounded border border-red-200 bg-red-50 text-red-900 text-sm">
            {error}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((item) => (
              <div
                key={item.label}
                className="border border-limestone bg-parchment/40 rounded-lg p-5 animate-pulse"
              >
                <div className="h-7 w-12 bg-limestone/70 rounded mb-2" />
                <div className="h-4 w-24 bg-limestone/50 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map((item) => (
                <div
                  key={item.label}
                  className="border border-limestone bg-ivory rounded-lg p-5"
                >
                  <p className="text-3xl font-mono font-semibold tabular-nums text-walnut-deep">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted mt-2 leading-snug">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {stats && stats.tong_ho_so === 0 && (
              <div className="border border-limestone bg-parchment/60 rounded-lg p-5 text-sm text-ink">
                Hiện cơ sở dữ liệu chưa có hồ sơ tư liệu nào được nạp. Hệ thống sẵn sàng tiếp nhận dữ liệu thật vào tệp lưu trữ gốc mà không tạo số liệu giả.
              </div>
            )}
          </>
        )}
      </section>

      {/* Tư liệu mới được bổ sung */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-limestone pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-walnut-deep">
              Tư liệu mới được bổ sung
            </h2>
            <p className="text-sm text-muted mt-1">
              Các hồ sơ đã được phê duyệt công khai gần nhất từ kho lưu trữ
            </p>
          </div>
          <Link
            to="/danh-sach"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep transition-colors whitespace-nowrap"
          >
            <span>Xem tất cả tư liệu</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {!loading && (!stats?.recent_records || stats.recent_records.length === 0) ? (
          <div className="border border-limestone bg-parchment/40 rounded-lg p-6 text-sm text-muted">
            Chưa có tư liệu mới được công bố trong hệ thống.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(stats?.recent_records || []).map((rec) => (
              <Link
                key={rec.identifier}
                to={`/tu-lieu/${encodeURIComponent(rec.identifier)}`}
                className="border border-limestone bg-ivory rounded-lg p-5 hover:border-bronze/70 hover:bg-parchment/40 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-bronze">
                    {rec.identifier}
                  </span>
                  <VerificationBadge status={rec.muc_kiem_chung} />
                </div>
                <h3 className="text-lg font-semibold text-walnut-deep">
                  {rec.title}
                </h3>
                {rec.chu_han_nom && (
                  <p lang="zh-Hant" className="font-hannom text-lg text-ink tracking-wider">
                    {rec.chu_han_nom}
                  </p>
                )}
                <p className="text-xs text-muted">
                  Nơi lưu giữ: {rec.noi_luu_giu_hien_nay || 'Chưa xác định'}
                  {rec.dong_ho_lien_quan ? ` · Dòng họ: ${rec.dong_ho_lien_quan}` : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Giá trị văn hóa truyền thống */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-limestone bg-parchment/50 rounded-lg p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-walnut-deep">
              Về hoành phi và câu đối trong văn hóa Hà Nội
            </h2>
            <p className="text-sm text-ink/90 leading-relaxed">
              Hoành phi và câu đối bằng chữ Hán, chữ Nôm là thành tố cốt lõi trong không gian kiến trúc tín ngưỡng và thờ tự gia tộc tại Thăng Long – Hà Nội. Mỗi bức đại tự hay vế đối lưu giữ triết lý giáo dục, gia phong dòng họ, lịch sử dựng làng và nghệ thuật thư pháp, chạm khắc cổ truyền.
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-walnut-deep">
              Ý nghĩa bảo tồn cộng đồng
            </h2>
            <p className="text-sm text-ink/90 leading-relaxed">
              Hệ thống phục vụ Ban quản lý di tích, các dòng họ, người dân địa phương, con cháu xa quê và giới nghiên cứu tra cứu chính xác nguồn gốc hiện vật, phân tách rõ phần đã kiểm chứng với nội dung tham khảo chưa kiểm chứng.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
