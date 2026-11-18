import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  bootstrapInitialAdmin,
  fetchAuthSession,
  loginAdmin,
} from '../../api/client.ts';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initial admin setup state (only available when 0 users exist)
  const [initUsername, setInitUsername] = useState('');
  const [initEmail, setInitEmail] = useState('');
  const [initFullName, setInitFullName] = useState('');
  const [initPassword, setInitPassword] = useState('');
  const [showInitPassword, setShowInitPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAuthSession()
      .then((res) => {
        if (!mounted) return;
        if (res.authenticated && res.user) {
          navigate(res.user.role === 'ADMIN' ? '/admin' : '/admin/kiem-duyet', {
            replace: true,
          });
          return;
        }
        setNeedsInitialAdmin(res.needsInitialAdmin);
        setChecking(false);
      })
      .catch(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await loginAdmin(identifier, password);
      if (res.user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/admin/kiem-duyet', { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(
        msg || 'Tên đăng nhập/email hoặc mật khẩu không chính xác.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await bootstrapInitialAdmin({
        username: initUsername,
        email: initEmail,
        full_name: initFullName,
        password: initPassword,
      });
      setSuccessMsg(
        `${res.message} Vui lòng đăng nhập bằng tài khoản "${res.user.username}".`
      );
      setNeedsInitialAdmin(false);
      setIdentifier(res.user.username);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể khởi tạo tài khoản quản trị ban đầu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-sm text-muted">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="border border-limestone bg-ivory rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-2 border-b border-limestone pb-4">
          <div className="flex items-center gap-2 text-bronze text-xs font-semibold uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Khu vực quản trị & kiểm duyệt</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-walnut-deep">
            {needsInitialAdmin
              ? 'Khởi tạo Quản trị viên ban đầu'
              : 'Đăng nhập hệ thống'}
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            {needsInitialAdmin
              ? 'Hệ thống chưa có tài khoản quản trị. Vui lòng thiết lập tài khoản ADMIN đầu tiên (chức năng này tự khóa sau khi hoàn tất).'
              : 'Dành cho Quản trị viên (ADMIN) và Người kiểm duyệt tư liệu (REVIEWER) được cấp tài khoản.'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded border border-red-200 bg-red-50 text-red-900 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 p-3.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {needsInitialAdmin ? (
          <form onSubmit={handleBootstrap} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Tên đăng nhập ADMIN *
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={initUsername}
                onChange={(e) => setInitUsername(e.target.value)}
                placeholder="Ví dụ: quantri_hanoi"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Email quản trị *
              </label>
              <input
                type="email"
                required
                value={initEmail}
                onChange={(e) => setInitEmail(e.target.value)}
                placeholder="admin@domain.vn"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Họ và tên hiển thị
              </label>
              <input
                type="text"
                value={initFullName}
                onChange={(e) => setInitFullName(e.target.value)}
                placeholder="Quản trị viên Ban Di sản"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Mật khẩu (tối thiểu 8 ký tự) *
              </label>
              <div className="relative">
                <input
                  type={showInitPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={initPassword}
                  onChange={(e) => setInitPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                />
                <button
                  type="button"
                  onClick={() => setShowInitPassword((v) => !v)}
                  aria-label={
                    showInitPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showInitPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Đang khởi tạo...'
                  : 'Khởi tạo tài khoản ADMIN'}
              </span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-ink mb-1"
              >
                Tên đăng nhập hoặc email
              </label>
              <input
                id="login-identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Nhập tên đăng nhập hoặc email"
                className="w-full px-3 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-ink mb-1"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full pl-3 pr-10 py-2 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-2.5 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-limestone flex items-center justify-between text-xs text-muted">
          <span>Không hỗ trợ tự đăng ký tài khoản</span>
          <Link to="/" className="text-bronze hover:underline">
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
