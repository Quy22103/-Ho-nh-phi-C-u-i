import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck2,
  FileClock,
  FilePlus2,
  FileX2,
  FolderArchive,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Shield,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  createAdminUser,
  fetchAdminAuditLogs,
  fetchAdminOverview,
  fetchAdminRecords,
  fetchAdminSources,
  fetchAdminSubmissions,
  fetchAdminUsers,
  fetchAuthSession,
  logoutAdmin,
  updateAdminUser,
  upsertAdminSource,
} from '../../api/client.ts';
import { ProcessingStatusBadge } from '../../components/ProcessingStatusBadge.tsx';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import { AdminOfficialRecordsTab } from './AdminOfficialRecordsTab.tsx';
import { AdminSubmissionDetail } from './AdminSubmissionDetail.tsx';
import type {
  ArchiveRecordRaw,
  ArchiveSource,
  AuditLogEntry,
  ProcessingStatus,
  SubmissionRecord,
  UserAccountSafe,
  VerificationLevel,
} from '../../types/archive.ts';

type AdminTab =
  | 'overview'
  | 'all_submissions'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'supplement'
  | 'official'
  | 'sources'
  | 'users'
  | 'logs';

export function AdminDashboardPage({
  defaultTab = 'overview',
}: {
  defaultTab?: AdminTab;
}) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserAccountSafe | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>(defaultTab);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);

  const [overview, setOverview] = useState<{
    statusCounts: Record<ProcessingStatus, number>;
    totalSubmissions: number;
    totalOfficialRecords: number;
    totalPublishedRecords: number;
    totalSources: number;
  } | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [records, setRecords] = useState<ArchiveRecordRaw[]>([]);
  const [sources, setSources] = useState<ArchiveSource[]>([]);
  const [users, setUsers] = useState<UserAccountSafe[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  const [loadingTab, setLoadingTab] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create User Form (ADMIN only)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'REVIEWER' as 'ADMIN' | 'REVIEWER',
    can_publish: false,
  });

  // Upsert Source Form
  const [sourceForm, setSourceForm] = useState<Partial<ArchiveSource>>({
    ma_nguon: '',
    ten_nguon: '',
    loai_nguon: 'Ảnh chụp tại di tích',
    tac_gia_hoac_nguoi_cung_cap: '',
    don_vi_hoac_ca_nhan_luu_giu: '',
    cong_khai_nguoi_cung_cap: false,
    dia_diem: '',
    nguoi_chup_anh: '',
    nguoi_phien_am: '',
    nguoi_kiem_chung: '',
    tai_lieu_tham_khao: '',
    tinh_trang_xac_minh: 'chua_kiem_chung',
    ho_so_lien_quan: [],
    ghi_chu: '',
  });
  const [sourceRecordIdsText, setSourceRecordIdsText] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchAuthSession()
      .then((res) => {
        if (!mounted) return;
        if (!res.authenticated || !res.user) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setCurrentUser(res.user);
        setAuthChecking(false);
      })
      .catch(() => {
        if (mounted) navigate('/admin/login', { replace: true });
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const loadTabData = async (tab: AdminTab, user: UserAccountSafe) => {
    setLoadingTab(true);
    setError('');
    try {
      if (tab === 'overview') {
        const res = await fetchAdminOverview();
        setOverview(res);
      } else if (tab === 'all_submissions') {
        const res = await fetchAdminSubmissions();
        setSubmissions(res.submissions);
      } else if (tab === 'pending') {
        const res = await fetchAdminSubmissions(
          'PENDING,CHO_XAC_NHAN,DANG_KIEM_TRA'
        );
        setSubmissions(res.submissions);
      } else if (tab === 'approved') {
        const res = await fetchAdminSubmissions(
          'DA_XAC_NHAN,CHO_CONG_KHAI,DA_CONG_KHAI'
        );
        setSubmissions(res.submissions);
      } else if (tab === 'rejected') {
        const res = await fetchAdminSubmissions('TU_CHOI');
        setSubmissions(res.submissions);
      } else if (tab === 'supplement') {
        const res = await fetchAdminSubmissions('CAN_BO_SUNG');
        setSubmissions(res.submissions);
      } else if (tab === 'official') {
        const res = await fetchAdminRecords();
        setRecords(res.records);
      } else if (tab === 'sources') {
        const res = await fetchAdminSources();
        setSources(res.sources);
      } else if (tab === 'users' && user.role === 'ADMIN') {
        const res = await fetchAdminUsers();
        setUsers(res.users);
      } else if (tab === 'logs') {
        const res = await fetchAdminAuditLogs();
        setLogs(res.logs);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    setSelectedSubmissionId(null);
    loadTabData(activeTab, currentUser);
  }, [activeTab, currentUser]);

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login', { replace: true });
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError('');
    setNotice('');
    try {
      const res = await createAdminUser(newUser);
      setNotice(`Đã tạo tài khoản ${res.user.username} (${res.user.role}).`);
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'REVIEWER',
        can_publish: false,
      });
      loadTabData('users', currentUser);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể tạo tài khoản.');
    }
  };

  const handleToggleLockUser = async (target: UserAccountSafe) => {
    if (!currentUser) return;
    setError('');
    setNotice('');
    try {
      await updateAdminUser(target.user_id, {
        is_locked: !target.is_locked,
        ly_do: !target.is_locked
          ? 'Quản trị viên khóa tài khoản'
          : 'Quản trị viên mở khóa tài khoản',
      });
      setNotice(
        `${!target.is_locked ? 'Đã khóa' : 'Đã mở khóa'} tài khoản ${target.username}.`
      );
      loadTabData('users', currentUser);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể cập nhật trạng thái tài khoản.');
    }
  };

  const handleToggleCanPublish = async (target: UserAccountSafe) => {
    if (!currentUser) return;
    setError('');
    setNotice('');
    try {
      await updateAdminUser(target.user_id, {
        can_publish: !target.can_publish,
        ly_do: 'Thay đổi quyền công khai hồ sơ',
      });
      setNotice(`Đã cập nhật quyền công khai cho ${target.username}.`);
      loadTabData('users', currentUser);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể cập nhật quyền.');
    }
  };

  const handleSaveSource = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError('');
    setNotice('');
    try {
      const hoSoList = sourceRecordIdsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await upsertAdminSource({
        ...sourceForm,
        ho_so_lien_quan: hoSoList,
      });
      setNotice(`Đã lưu nguồn tư liệu ${res.source.ma_nguon}.`);
      setSourceForm({
        ma_nguon: '',
        ten_nguon: '',
        loai_nguon: 'Ảnh chụp tại di tích',
        tac_gia_hoac_nguoi_cung_cap: '',
        don_vi_hoac_ca_nhan_luu_giu: '',
        cong_khai_nguoi_cung_cap: false,
        dia_diem: '',
        nguoi_chup_anh: '',
        nguoi_phien_am: '',
        nguoi_kiem_chung: '',
        tai_lieu_tham_khao: '',
        tinh_trang_xac_minh: 'chua_kiem_chung',
        ho_so_lien_quan: [],
        ghi_chu: '',
      });
      setSourceRecordIdsText('');
      loadTabData('sources', currentUser);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || 'Không thể lưu nguồn tư liệu.');
    }
  };

  if (authChecking || !currentUser) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-sm text-muted">
        Đang xác thực quyền truy cập...
      </div>
    );
  }

  const reviewMenuButtons: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'all_submissions', label: 'Tất cả tư liệu', icon: FolderArchive },
    { id: 'pending', label: 'Tư liệu chờ duyệt', icon: FileClock },
    { id: 'approved', label: 'Tư liệu đã duyệt', icon: FileCheck2 },
    { id: 'rejected', label: 'Tư liệu bị từ chối', icon: FileX2 },
    { id: 'supplement', label: 'Tư liệu cần bổ sung', icon: FilePlus2 },
  ];

  const systemNavButtons: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    adminOnly?: boolean;
  }> = [
    { id: 'official', label: 'Quản lý hồ sơ chính thức', icon: Database },
    { id: 'sources', label: 'Quản lý nguồn tư liệu', icon: BookOpen },
    {
      id: 'users',
      label: 'Quản lý tài khoản',
      icon: Users,
      adminOnly: true,
    },
    { id: 'logs', label: 'Lịch sử thao tác', icon: History },
  ];

  const statusLabels: Array<{ key: ProcessingStatus; label: string }> = [
    { key: 'PENDING', label: 'Chờ duyệt (PENDING)' },
    { key: 'CHO_XAC_NHAN', label: 'Chờ xác nhận (CHO_XAC_NHAN)' },
    { key: 'DANG_KIEM_TRA', label: 'Đang kiểm tra (DANG_KIEM_TRA)' },
    { key: 'CAN_BO_SUNG', label: 'Cần bổ sung (CAN_BO_SUNG)' },
    { key: 'DA_XAC_NHAN', label: 'Đã xác nhận (DA_XAC_NHAN)' },
    { key: 'CHO_CONG_KHAI', label: 'Chờ công khai (CHO_CONG_KHAI)' },
    { key: 'DA_CONG_KHAI', label: 'Đã công khai (DA_CONG_KHAI)' },
    { key: 'TU_CHOI', label: 'Từ chối (TU_CHOI)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-limestone pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">
            Hệ thống quản trị & kiểm duyệt tư liệu
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-walnut-deep">
            {currentUser.role === 'ADMIN'
              ? 'Bảng điều khiển Quản trị viên'
              : 'Khu vực Kiểm duyệt tư liệu'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded border border-limestone bg-parchment/60 text-xs">
            <span className="font-semibold text-walnut-deep">
              {currentUser.full_name}
            </span>
            <span className="mx-1.5 text-muted">·</span>
            <span className="font-mono font-bold text-bronze">
              {currentUser.role}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-limestone bg-ivory rounded hover:bg-parchment text-ink transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded border border-red-200 bg-red-50 text-red-900 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 p-3.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Nav */}
        <aside className="lg:col-span-3 border border-limestone bg-parchment/40 rounded-lg p-3 space-y-3">
          <div>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs font-medium text-left transition-colors ${
                activeTab === 'overview'
                  ? 'bg-walnut text-ivory font-semibold'
                  : 'text-ink hover:bg-ivory'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Tổng quan</span>
            </button>
          </div>

          <div className="pt-2 border-t border-limestone/70 space-y-1">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-bronze">
              Quản lý tư liệu
            </p>
            {reviewMenuButtons.map((btn) => {
              const Icon = btn.icon;
              const isActive = activeTab === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActiveTab(btn.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-left transition-colors ${
                    isActive
                      ? 'bg-walnut text-ivory font-semibold'
                      : 'text-ink hover:bg-ivory'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-limestone/70 space-y-1">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Hệ thống & Kho dữ liệu
            </p>
            {systemNavButtons
              .filter((b) => !b.adminOnly || currentUser.role === 'ADMIN')
              .map((btn) => {
                const Icon = btn.icon;
                const isActive = activeTab === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setActiveTab(btn.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-left transition-colors ${
                      isActive
                        ? 'bg-walnut text-ivory font-semibold'
                        : 'text-ink hover:bg-ivory'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
          </div>
        </aside>

        {/* Main Workspace */}
        <section className="lg:col-span-9 space-y-6">
          {loadingTab ? (
            <div className="h-64 border border-limestone bg-parchment/30 rounded-lg animate-pulse" />
          ) : selectedSubmissionId ? (
            <AdminSubmissionDetail
              submissionId={selectedSubmissionId}
              currentUser={currentUser}
              onBack={() => {
                setSelectedSubmissionId(null);
                loadTabData(activeTab, currentUser);
              }}
              onUpdated={() => {
                loadTabData(activeTab, currentUser);
              }}
            />
          ) : activeTab === 'overview' && overview ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-limestone bg-ivory rounded-lg p-4">
                  <p className="text-2xl font-mono font-bold tabular-nums text-walnut-deep">
                    {overview.totalSubmissions}
                  </p>
                  <p className="text-xs text-muted mt-1">Tổng phiếu tiếp nhận</p>
                </div>
                <div className="border border-limestone bg-ivory rounded-lg p-4">
                  <p className="text-2xl font-mono font-bold tabular-nums text-walnut-deep">
                    {overview.totalOfficialRecords}
                  </p>
                  <p className="text-xs text-muted mt-1">Hồ sơ trong dữ liệu chính</p>
                </div>
                <div className="border border-limestone bg-ivory rounded-lg p-4">
                  <p className="text-2xl font-mono font-bold tabular-nums text-emerald-800">
                    {overview.totalPublishedRecords}
                  </p>
                  <p className="text-xs text-muted mt-1">Hồ sơ đang công khai</p>
                </div>
                <div className="border border-limestone bg-ivory rounded-lg p-4">
                  <p className="text-2xl font-mono font-bold tabular-nums text-walnut-deep">
                    {overview.totalSources}
                  </p>
                  <p className="text-xs text-muted mt-1">Nguồn tư liệu</p>
                </div>
              </div>

              <div className="border border-limestone bg-ivory rounded-lg p-5 space-y-4">
                <h2 className="text-xl font-semibold text-walnut-deep border-b border-limestone pb-2">
                  Số lượng hồ sơ tiếp nhận theo từng trạng thái xử lý
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {statusLabels.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 rounded border border-limestone bg-parchment/30 text-xs"
                    >
                      <span className="font-medium text-ink">{item.label}</span>
                      <span className="font-mono font-bold tabular-nums text-walnut-deep text-sm">
                        {overview.statusCounts[item.key] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : [
              'all_submissions',
              'pending',
              'approved',
              'rejected',
              'supplement',
            ].includes(activeTab) ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-walnut-deep">
                  {activeTab === 'all_submissions' && 'Tất cả tư liệu tiếp nhận'}
                  {activeTab === 'pending' && 'Tư liệu chờ duyệt & đang kiểm tra'}
                  {activeTab === 'approved' && 'Tư liệu đã duyệt'}
                  {activeTab === 'rejected' && 'Tư liệu bị từ chối'}
                  {activeTab === 'supplement' && 'Tư liệu cần bổ sung'}
                </h2>
                <span className="text-xs font-mono text-muted">
                  Tổng: {submissions.length} hồ sơ
                </span>
              </div>

              {submissions.length === 0 ? (
                <div className="border border-limestone bg-parchment/40 rounded-lg p-8 text-center text-sm text-muted">
                  Hiện chưa có hồ sơ nào trong nhóm trạng thái này.
                </div>
              ) : (
                <div className="border border-limestone bg-ivory rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-parchment border-b border-limestone uppercase tracking-wider text-muted">
                        <th className="py-3 px-4">Mã tiếp nhận</th>
                        <th className="py-3 px-4">Tên tư liệu</th>
                        <th className="py-3 px-4">Nơi lưu giữ</th>
                        <th className="py-3 px-4">Trạng thái duyệt</th>
                        <th className="py-3 px-4">Ngày gửi</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-limestone">
                      {submissions.map((item) => (
                        <tr key={item.submission_id} className="hover:bg-parchment/25">
                          <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                            {item.submission_id}
                          </td>
                          <td className="py-3 px-4 font-medium text-walnut-deep">
                            {item.ten_tu_lieu}
                          </td>
                          <td className="py-3 px-4 text-muted">
                            {item.noi_luu_giu}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <ProcessingStatusBadge
                              status={item.trang_thai_xu_ly}
                            />
                          </td>
                          <td className="py-3 px-4 font-mono whitespace-nowrap">
                            {item.ngay_gui.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                            <Link
                              to={`/admin/duyet-tu-lieu/${encodeURIComponent(item.submission_id)}`}
                              className="font-semibold text-bronze hover:underline"
                            >
                              Chi tiết duyệt
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSubmissionId(item.submission_id)
                              }
                              className="text-muted hover:text-ink underline"
                            >
                              Mở nhanh
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'official' ? (
            <AdminOfficialRecordsTab
              currentUser={currentUser}
              records={records}
              onReload={() => loadTabData('official', currentUser)}
              onNotice={setNotice}
              onError={setError}
            />
          ) : activeTab === 'sources' ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-walnut-deep">
                Quản lý nguồn tư liệu
              </h2>

              <form
                onSubmit={handleSaveSource}
                className="border border-limestone bg-ivory rounded-lg p-5 space-y-4 text-xs"
              >
                <p className="font-semibold text-sm text-walnut-deep">
                  Thêm mới hoặc cập nhật nguồn tư liệu
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={sourceForm.ma_nguon || ''}
                    onChange={(e) =>
                      setSourceForm({ ...sourceForm, ma_nguon: e.target.value })
                    }
                    placeholder="Mã nguồn (ví dụ: NGUON-001) *"
                    className="px-3 py-2 bg-white border border-limestone rounded font-mono"
                  />
                  <input
                    type="text"
                    required
                    value={sourceForm.ten_nguon || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        ten_nguon: e.target.value,
                      })
                    }
                    placeholder="Tên nguồn *"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <select
                    value={sourceForm.loai_nguon || 'Ảnh chụp tại di tích'}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        loai_nguon: e.target.value,
                      })
                    }
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  >
                    <option value="Ảnh chụp tại di tích">
                      Ảnh chụp tại di tích
                    </option>
                    <option value="Ảnh do dòng họ cung cấp">
                      Ảnh do dòng họ cung cấp
                    </option>
                    <option value="Tư liệu của Ban quản lý">
                      Tư liệu của Ban quản lý
                    </option>
                    <option value="Sách nghiên cứu">Sách nghiên cứu</option>
                    <option value="Tài liệu Hán Nôm">Tài liệu Hán Nôm</option>
                    <option value="Hồ sơ di tích">Hồ sơ di tích</option>
                    <option value="Bài báo">Bài báo</option>
                    <option value="Tài liệu lưu trữ">Tài liệu lưu trữ</option>
                    <option value="Nguồn khác">Nguồn khác</option>
                  </select>
                  <input
                    type="text"
                    value={sourceForm.tac_gia_hoac_nguoi_cung_cap || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        tac_gia_hoac_nguoi_cung_cap: e.target.value,
                      })
                    }
                    placeholder="Tác giả hoặc người cung cấp"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceForm.don_vi_hoac_ca_nhan_luu_giu || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        don_vi_hoac_ca_nhan_luu_giu: e.target.value,
                      })
                    }
                    placeholder="Đơn vị hoặc cá nhân lưu giữ"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceForm.dia_diem || ''}
                    onChange={(e) =>
                      setSourceForm({ ...sourceForm, dia_diem: e.target.value })
                    }
                    placeholder="Địa điểm"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceForm.nguoi_chup_anh || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        nguoi_chup_anh: e.target.value,
                      })
                    }
                    placeholder="Người chụp ảnh"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceForm.nguoi_phien_am || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        nguoi_phien_am: e.target.value,
                      })
                    }
                    placeholder="Người phiên âm"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceForm.nguoi_kiem_chung || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        nguoi_kiem_chung: e.target.value,
                      })
                    }
                    placeholder="Người kiểm chứng"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <select
                    value={
                      sourceForm.tinh_trang_xac_minh || 'chua_kiem_chung'
                    }
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        tinh_trang_xac_minh: e.target
                          .value as VerificationLevel,
                      })
                    }
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  >
                    <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                    <option value="da_kiem_chung">Đã kiểm chứng</option>
                    <option value="chua_doc_duoc">Chưa đọc được</option>
                  </select>
                  <input
                    type="text"
                    value={sourceForm.tai_lieu_tham_khao || ''}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        tai_lieu_tham_khao: e.target.value,
                      })
                    }
                    placeholder="Tài liệu tham khảo"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    value={sourceRecordIdsText}
                    onChange={(e) => setSourceRecordIdsText(e.target.value)}
                    placeholder="Mã hồ sơ liên quan (phân tách dấu phẩy)"
                    className="px-3 py-2 bg-white border border-limestone rounded font-mono"
                  />
                </div>
                <textarea
                  rows={2}
                  value={sourceForm.ghi_chu || ''}
                  onChange={(e) =>
                    setSourceForm({ ...sourceForm, ghi_chu: e.target.value })
                  }
                  placeholder="Ghi chú nguồn tư liệu..."
                  className="w-full px-3 py-2 bg-white border border-limestone rounded"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(sourceForm.cong_khai_nguoi_cung_cap)}
                      onChange={(e) =>
                        setSourceForm({
                          ...sourceForm,
                          cong_khai_nguoi_cung_cap: e.target.checked,
                        })
                      }
                    />
                    <span>Cho phép công khai tên người cung cấp</span>
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep"
                  >
                    Lưu nguồn tư liệu
                  </button>
                </div>
              </form>

              {sources.length === 0 ? (
                <p className="text-sm text-muted">
                  Chưa có thông tin nguồn tư liệu.
                </p>
              ) : (
                <div className="space-y-3">
                  {sources.map((s) => (
                    <div
                      key={s.ma_nguon}
                      className="border border-limestone bg-ivory rounded p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div>
                          <span className="font-mono font-bold text-walnut-deep mr-2">
                            {s.ma_nguon}
                          </span>
                          <span className="font-semibold text-ink">
                            {s.ten_nguon}
                          </span>
                          <span className="ml-2 text-muted">
                            ({s.loai_nguon})
                          </span>
                        </div>
                        {(s.don_vi_hoac_ca_nhan_luu_giu ||
                          s.nguoi_chup_anh ||
                          s.nguoi_phien_am ||
                          s.nguoi_kiem_chung) && (
                          <div className="text-[11px] text-muted flex flex-wrap gap-3">
                            {s.don_vi_hoac_ca_nhan_luu_giu && (
                              <span>
                                Lưu giữ: {s.don_vi_hoac_ca_nhan_luu_giu}
                              </span>
                            )}
                            {s.nguoi_chup_anh && (
                              <span>Chụp ảnh: {s.nguoi_chup_anh}</span>
                            )}
                            {s.nguoi_phien_am && (
                              <span>Phiên âm: {s.nguoi_phien_am}</span>
                            )}
                            {s.nguoi_kiem_chung && (
                              <span>Kiểm chứng: {s.nguoi_kiem_chung}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <VerificationBadge status={s.tinh_trang_xac_minh} />
                        <button
                          type="button"
                          onClick={() => {
                            setSourceForm(s);
                            setSourceRecordIdsText(
                              (s.ho_so_lien_quan || []).join(', ')
                            );
                          }}
                          className="font-semibold text-bronze hover:underline"
                        >
                          Sửa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'users' && currentUser.role === 'ADMIN' ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-walnut-deep">
                Quản lý tài khoản kiểm duyệt & quản trị (Chỉ ADMIN)
              </h2>

              <form
                onSubmit={handleCreateUser}
                className="border border-limestone bg-ivory rounded-lg p-5 space-y-4 text-xs"
              >
                <p className="font-semibold text-sm text-walnut-deep flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-bronze" />
                  <span>Cấp tài khoản mới</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser({ ...newUser, username: e.target.value })
                    }
                    placeholder="Tên đăng nhập *"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="Email *"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="text"
                    required
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, full_name: e.target.value })
                    }
                    placeholder="Họ và tên *"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    placeholder="Mật khẩu (>= 8 ký tự) *"
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as 'ADMIN' | 'REVIEWER',
                      })
                    }
                    className="px-3 py-2 bg-white border border-limestone rounded"
                  >
                    <option value="REVIEWER">
                      Người kiểm duyệt (REVIEWER)
                    </option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                  <label className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      checked={
                        newUser.role === 'ADMIN' ? true : newUser.can_publish
                      }
                      disabled={newUser.role === 'ADMIN'}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          can_publish: e.target.checked,
                        })
                      }
                    />
                    <span>Cho phép công khai hồ sơ trực tiếp</span>
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep"
                  >
                    Tạo tài khoản
                  </button>
                </div>
              </form>

              <div className="border border-limestone bg-ivory rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-parchment border-b border-limestone uppercase tracking-wider text-muted">
                      <th className="py-3 px-4">Tài khoản</th>
                      <th className="py-3 px-4">Họ tên / Email</th>
                      <th className="py-3 px-4">Vai trò</th>
                      <th className="py-3 px-4">Quyền công khai</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-limestone">
                    {users.map((u) => (
                      <tr key={u.user_id}>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {u.username}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-ink">
                            {u.full_name}
                          </div>
                          <div className="text-muted">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-bronze">
                          {u.role}
                        </td>
                        <td className="py-3 px-4">
                          {u.role === 'ADMIN' ? (
                            <span className="text-emerald-800 font-medium">
                              Toàn quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCanPublish(u)}
                              className="underline text-walnut-deep"
                            >
                              {u.can_publish ? 'Được công khai' : 'Chờ ADMIN'}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_locked ? (
                            <span className="text-red-800 font-semibold">
                              Đang bị khóa
                            </span>
                          ) : (
                            <span className="text-emerald-800 font-medium">
                              Hoạt động
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {u.user_id !== currentUser.user_id ? (
                            <button
                              type="button"
                              onClick={() => handleToggleLockUser(u)}
                              className="inline-flex items-center gap-1 font-semibold text-bronze hover:underline"
                            >
                              {u.is_locked ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Mở khóa</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Khóa</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-muted inline-flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" />
                              <span>Đang dùng</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'logs' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-walnut-deep flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-bronze" />
                  <span>Lịch sử thao tác & xác nhận (bất biến)</span>
                </h2>
              </div>

              {logs.length === 0 ? (
                <div className="border border-limestone bg-parchment/40 rounded-lg p-8 text-center text-sm text-muted">
                  Chưa có bản ghi lịch sử thao tác nào.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.log_id}
                      className="border border-limestone bg-ivory rounded-lg p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-limestone/70 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-walnut-deep">
                            {log.ma_ho_so}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-parchment border border-limestone font-mono">
                            {log.hanh_dong}
                          </span>
                          <span className="text-muted">
                            Thực hiện:{' '}
                            <strong className="text-ink">
                              {log.tai_khoan}
                            </strong>{' '}
                            ({log.vai_tro})
                          </span>
                        </div>
                        <span className="font-mono text-muted">
                          {new Date(log.thoi_gian).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      {log.ly_do && (
                        <p className="text-ink">
                          <span className="text-muted font-semibold">
                            Lý do / Ghi chú:{' '}
                          </span>
                          {log.ly_do}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="bg-parchment/40 p-2.5 rounded border border-limestone overflow-x-auto">
                          <p className="font-semibold text-muted mb-1">
                            Nội dung trước khi sửa
                          </p>
                          <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">
                            {log.noi_dung_truoc}
                          </pre>
                        </div>
                        <div className="bg-parchment/40 p-2.5 rounded border border-limestone overflow-x-auto">
                          <p className="font-semibold text-muted mb-1">
                            Nội dung sau khi sửa
                          </p>
                          <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">
                            {log.noi_dung_sau}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
