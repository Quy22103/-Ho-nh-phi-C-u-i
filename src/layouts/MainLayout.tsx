import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { SubmissionModal } from '../components/SubmissionModal.tsx';
import { SubmissionLookupModal } from '../components/SubmissionLookupModal.tsx';

interface MainLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/danh-sach', label: 'Danh sách tư liệu' },
  { to: '/hoi-dap', label: 'Hỏi đáp AI' },
  { to: '/nguon-tu-lieu', label: 'Nguồn tư liệu' },
  { to: '/gioi-thieu', label: 'Giới thiệu' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-ink">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur-sm border-b border-limestone">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-walnut-deep font-display text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap shrink-0"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              className="text-bronze shrink-0"
            >
              <rect
                x="3"
                y="6"
                width="26"
                height="20"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="7"
                y="10"
                width="18"
                height="12"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <path
                d="M12 16H20M16 13V19"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>Hồ sơ số Hoành phi – Câu đối Hà Nội</span>
          </Link>

          {/* Zone 2: Nav Links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-walnut-deep border-bronze font-semibold'
                      : 'border-transparent hover:text-walnut-deep hover:border-limestone'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: 1 Primary CTA + Mobile Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/danh-sach')}
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep transition-colors whitespace-nowrap shrink-0"
            >
              Tra cứu ngay
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileOpen}
              className="lg:hidden p-2 rounded border border-limestone text-walnut-deep hover:bg-parchment transition-colors"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-limestone bg-ivory px-4 py-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-parchment text-walnut-deep font-semibold'
                      : 'text-ink hover:bg-parchment/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-limestone">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/danh-sach');
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep transition-colors"
              >
                Tra cứu ngay
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-limestone bg-parchment/60 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <p className="font-display text-lg font-semibold text-walnut-deep">
              Hồ sơ số Hoành phi – Câu đối Hà Nội
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Hệ thống lưu trữ tư liệu di sản Hán Nôm tại đình, chùa, đền, miếu và nhà thờ họ trên địa bàn thành phố Hà Nội. Mọi tư liệu đều gắn nguồn gốc và trạng thái kiểm chứng minh bạch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSubmissionOpen(true)}
              className="px-4 py-2 rounded border border-bronze text-bronze hover:bg-bronze hover:text-ivory transition-colors whitespace-nowrap"
            >
              Đóng góp tư liệu mới
            </button>
            <button
              type="button"
              onClick={() => setLookupOpen(true)}
              className="px-4 py-2 rounded border border-limestone bg-ivory text-walnut-deep hover:bg-parchment transition-colors whitespace-nowrap"
            >
              Tra cứu mã tiếp nhận
            </button>
            <Link
              to="/gioi-thieu"
              className="text-walnut-deep hover:underline whitespace-nowrap"
            >
              Giới thiệu & Xuất dữ liệu
            </Link>
            <Link
              to="/admin/login"
              className="text-muted hover:text-walnut-deep hover:underline whitespace-nowrap"
            >
              Đăng nhập kiểm duyệt
            </Link>
          </div>
        </div>
      </footer>

      <SubmissionModal
        open={submissionOpen}
        onClose={() => setSubmissionOpen(false)}
      />
      <SubmissionLookupModal
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
      />
    </div>
  );
}
