import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  FileEdit,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  fetchAuthSession,
  fetchRecordDetail,
  fetchSystemStatus,
  requestTranscriptionSuggestion,
  updateAdminOfficialRecord,
} from '../../api/client.ts';
import { ArtifactImageViewer } from '../../components/ArtifactImageViewer.tsx';
import { SubmissionModal } from '../../components/SubmissionModal.tsx';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type {
  ArchiveSource,
  PublicRecord,
  TranscriptionSuggestionResponse,
  UserAccountSafe,
  VerificationLevel,
} from '../../types/archive.ts';

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | string[] | null;
}) {
  const formatted = Array.isArray(value)
    ? value.filter(Boolean).join(', ')
    : (value || '').trim();
  if (!formatted) return null;

  return (
    <div className="py-2.5 border-b border-limestone/70 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
      <dt className="text-muted font-medium">{label}</dt>
      <dd className="sm:col-span-2 text-ink">{formatted}</dd>
    </div>
  );
}

export function ChiTietPage() {
  const { identifier } = useParams<{ identifier: string }>();
  const [record, setRecord] = useState<PublicRecord | null>(null);
  const [linkedSources, setLinkedSources] = useState<ArchiveSource[]>([]);
  const [selectedImageId, setSelectedImageId] = useState('');
  const [geminiConfigured, setGeminiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gemini AI transcription suggestion local workspace (never auto-saved)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] =
    useState<TranscriptionSuggestionResponse | null>(null);
  const [hanNomDraft, setHanNomDraft] = useState('');
  const [phienAmDraft, setPhienAmDraft] = useState('');
  const [dichNghiaDraft, setDichNghiaDraft] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [editRequestOpen, setEditRequestOpen] = useState(false);

  // Authenticated manager explicit save of Gemini proposal
  const [authUser, setAuthUser] = useState<UserAccountSafe | null>(null);
  const [saveVerification, setSaveVerification] =
    useState<VerificationLevel>('chua_kiem_chung');
  const [savingAi, setSavingAi] = useState(false);
  const [saveAiNotice, setSaveAiNotice] = useState('');
  const [saveAiError, setSaveAiError] = useState('');

  useEffect(() => {
    if (!identifier) return;
    let mounted = true;
    setLoading(true);
    setError('');

    Promise.all([
      fetchRecordDetail(identifier),
      fetchSystemStatus().catch(() => ({ ok: true, geminiConfigured: false })),
      fetchAuthSession().catch(() => ({
        authenticated: false,
        needsInitialAdmin: false,
        user: null,
      })),
    ])
      .then(([detailRes, statusRes, authRes]) => {
        if (!mounted) return;
        setRecord(detailRes.record);
        setLinkedSources(detailRes.linkedSources);
        setGeminiConfigured(statusRes.geminiConfigured);
        setAuthUser(authRes.authenticated ? authRes.user : null);
        if (detailRes.record.images.length > 0) {
          setSelectedImageId(detailRes.record.images[0].image_id);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error;
        setError(msg || 'Không tìm thấy hồ sơ tư liệu được yêu cầu.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [identifier]);

  const handleRequestAiTranscription = async () => {
    if (!record || !selectedImageId) return;
    setAiLoading(true);
    setAiError('');
    setSaveAiNotice('');
    setSaveAiError('');
    try {
      const res = await requestTranscriptionSuggestion(
        record.identifier,
        selectedImageId
      );
      if (!res.configured && res.error) {
        setAiError(res.error);
      } else {
        setAiResult(res);
        setHanNomDraft(res.han_nom_detected || '');
        setPhienAmDraft(res.phien_am_de_xuat || res.suggestion || '');
        setDichNghiaDraft(res.dich_nghia_tham_khao || '');
        setReviewerNotes(res.notes || '');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setAiError(
        msg ||
          'Không thể tạo đề xuất phiên âm từ Gemini lúc này. Vui lòng thử lại sau.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyDraft = async () => {
    const content = [
      hanNomDraft ? `Chữ Hán/Nôm: ${hanNomDraft}` : '',
      phienAmDraft ? `Phiên âm: ${phienAmDraft}` : '',
      dichNghiaDraft ? `Dịch nghĩa: ${dichNghiaDraft}` : '',
      reviewerNotes ? `Ghi chú: ${reviewerNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSaveAiProposalToRecord = async () => {
    if (!record || !authUser) return;
    setSavingAi(true);
    setSaveAiNotice('');
    setSaveAiError('');
    try {
      await updateAdminOfficialRecord(record.identifier, {
        chu_han_nom: hanNomDraft.trim() || record.chu_han_nom,
        phien_am_noi_dung: phienAmDraft.trim() || record.phien_am.noi_dung,
        dich_nghia_noi_dung:
          dichNghiaDraft.trim() || record.dich_nghia.noi_dung,
        phien_am_trang_thai: saveVerification,
        dich_nghia_trang_thai: saveVerification,
        ghi_chu_nghien_cuu: reviewerNotes.trim() || undefined,
        ly_do:
          'Người quản lý xác nhận và lưu nội dung đề xuất phiên âm/dịch nghĩa đã đối chiếu',
      });
      const refreshed = await fetchRecordDetail(record.identifier);
      setRecord(refreshed.record);
      setLinkedSources(refreshed.linkedSources);
      setSaveAiNotice(
        'Đã xác nhận và lưu nội dung chỉnh sửa vào hồ sơ chính thức.'
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setSaveAiError(
        msg || 'Không thể lưu đề xuất vào hồ sơ. Vui lòng kiểm tra quyền truy cập.'
      );
    } finally {
      setSavingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-10 w-64 bg-parchment rounded animate-pulse mb-6" />
        <div className="h-96 bg-parchment/50 border border-limestone rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center space-y-4">
        <p className="text-lg font-medium text-walnut-deep">
          {error || 'Không tìm thấy hồ sơ tư liệu.'}
        </p>
        <Link
          to="/danh-sach"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-walnut text-ivory rounded hover:bg-walnut-deep"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách tư liệu</span>
        </Link>
      </div>
    );
  }

  const hasHanNomContent =
    Boolean(record.chu_han_nom?.trim()) ||
    Boolean(record.phien_am?.noi_dung?.trim()) ||
    Boolean(record.dich_nghia?.noi_dung?.trim());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumb & Title Header */}
      <div className="space-y-4 border-b border-limestone pb-6">
        <Link
          to="/danh-sach"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-bronze hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh sách tư liệu</span>
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-mono tabular-nums font-semibold text-walnut-deep">
                {record.identifier}
              </span>
              <span aria-hidden="true">·</span>
              <span>{record.type || 'Chưa xác định loại tư liệu'}</span>
              {record.loai_ban_dang_hien_thi && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{record.loai_ban_dang_hien_thi}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-walnut-deep text-balance">
              {record.title}
            </h1>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2.5">
            <VerificationBadge
              status={record.muc_kiem_chung}
              prefix="Hồ sơ tổng thể"
            />
            <button
              type="button"
              onClick={() => setEditRequestOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-bronze text-bronze bg-ivory rounded hover:bg-parchment transition-colors whitespace-nowrap"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Đề nghị chỉnh sửa / bổ sung thông tin</span>
            </button>
          </div>
        </div>
      </div>

      {/* B & C. Bộ xem ảnh tư liệu & Quy tắc quyền công bố */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-walnut-deep">
          Hình ảnh tư liệu
        </h2>
        <ArtifactImageViewer
          title={record.title}
          images={record.images}
          publicationAllowed={record.image_publication_allowed}
          restrictionReason={record.image_restriction_reason}
          selectedImageId={selectedImageId}
          onSelectImage={setSelectedImageId}
        />
      </section>

      {/* D & E. Nội dung chữ Hán/Nôm & Nhãn kiểm chứng độc lập */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-5">
            <div className="border-b border-limestone pb-3">
              <h2 className="text-2xl font-semibold text-walnut-deep">
                Nội dung chữ Hán / Nôm, phiên âm và dịch nghĩa
              </h2>
              <p className="text-xs text-muted mt-1">
                Trạng thái kiểm chứng của phiên âm và dịch nghĩa được quản lý độc lập với hình ảnh và hồ sơ chung.
              </p>
            </div>

            {!hasHanNomContent ? (
              <p className="text-sm text-muted py-4">
                Chưa có dữ liệu phiên âm hoặc dịch nghĩa cho tư liệu này.
              </p>
            ) : (
              <div className="space-y-6">
                {/* 1. Chữ Hán/Nôm nguyên bản */}
                {record.chu_han_nom?.trim() && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                        1. Chữ Hán/Nôm nguyên bản
                      </h3>
                    </div>
                    <p
                      lang="zh-Hant"
                      className="font-hannom text-2xl sm:text-3xl text-walnut-deep tracking-widest bg-parchment/50 border border-limestone rounded p-4 leading-relaxed"
                    >
                      {record.chu_han_nom}
                    </p>
                  </div>
                )}

                {/* 2. Phiên âm Hán Việt */}
                <div className="space-y-2 pt-4 border-t border-limestone">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                      2. Phiên âm Hán Việt
                    </h3>
                    <VerificationBadge status={record.phien_am.trang_thai} />
                  </div>
                  {record.phien_am.noi_dung?.trim() ? (
                    <p className="text-base font-serif text-ink leading-relaxed">
                      {record.phien_am.noi_dung}
                    </p>
                  ) : (
                    <p className="text-sm text-muted italic">
                      Chưa có dữ liệu phiên âm cho tư liệu này.
                    </p>
                  )}
                </div>

                {/* 3. Dịch nghĩa tiếng Việt */}
                <div className="space-y-2 pt-4 border-t border-limestone">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                      3. Dịch nghĩa tiếng Việt
                    </h3>
                    <VerificationBadge status={record.dich_nghia.trang_thai} />
                  </div>
                  {record.dich_nghia.noi_dung?.trim() ? (
                    <p className="text-base font-serif text-ink leading-relaxed">
                      {record.dich_nghia.noi_dung}
                    </p>
                  ) : (
                    <p className="text-sm text-muted italic">
                      Chưa có dữ liệu dịch nghĩa cho tư liệu này.
                    </p>
                  )}
                </div>

                {/* 4. Giải thích nội dung */}
                {record.giai_thich_noi_dung?.noi_dung?.trim() && (
                  <div className="space-y-2 pt-4 border-t border-limestone">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                        4. Giải thích nội dung
                      </h3>
                      <VerificationBadge
                        status={record.giai_thich_noi_dung.trang_thai}
                      />
                    </div>
                    <p className="text-sm text-ink leading-relaxed">
                      {record.giai_thich_noi_dung.noi_dung}
                    </p>
                  </div>
                )}

                {/* 5. Ghi chú của người nghiên cứu */}
                {(record.ghi_chu_nghien_cuu?.noi_dung?.trim() ||
                  record.ghi_chu?.trim()) && (
                  <div className="space-y-2 pt-4 border-t border-limestone">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                        5. Ghi chú của người nghiên cứu
                      </h3>
                      {record.ghi_chu_nghien_cuu && (
                        <VerificationBadge
                          status={record.ghi_chu_nghien_cuu.trang_thai}
                        />
                      )}
                    </div>
                    <p className="text-sm text-ink leading-relaxed">
                      {record.ghi_chu_nghien_cuu?.noi_dung || record.ghi_chu}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* F. Gemini đề xuất phiên âm từ ảnh */}
          <div className="border border-limestone bg-parchment/50 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-walnut-deep">
                  Hỗ trợ đọc chữ Hán/Nôm bằng AI
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Chỉ xử lý trên ảnh đã được phép công bố. Kết quả chỉ để tham khảo, không tự động lưu vào cơ sở dữ liệu.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestAiTranscription}
                disabled={
                  aiLoading ||
                  !record.image_publication_allowed ||
                  !selectedImageId ||
                  !geminiConfigured
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-bronze text-ivory rounded hover:bg-walnut disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>
                  {aiLoading
                    ? 'Đang phân tích ảnh...'
                    : 'Nhờ Gemini đề xuất phiên âm từ ảnh'}
                </span>
              </button>
            </div>

            {!geminiConfigured && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
                Chức năng đề xuất phiên âm hiện chưa được cấu hình GEMINI_API_KEY phía máy chủ.
              </p>
            )}

            {!record.image_publication_allowed && (
              <p className="text-xs text-muted">
                {record.image_restriction_reason.includes('chưa đính kèm hình ảnh')
                  ? 'Chức năng phân tích ảnh bằng AI yêu cầu hồ sơ có hình ảnh tư liệu đã được phép công bố.'
                  : 'Chức năng này bị khóa do hình ảnh tư liệu chưa được xác nhận quyền công bố.'}
              </p>
            )}

            {aiError && (
              <div className="p-3 rounded border border-red-200 bg-red-50 text-red-900 text-xs">
                {aiError}
              </div>
            )}

            {aiResult && (
              <div className="border border-amber-300 bg-ivory rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{aiResult.label || 'Chưa kiểm – Nội dung do AI đề xuất'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-limestone rounded hover:bg-parchment transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép kết quả</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Chữ Hán/Nôm đề xuất (có thể chỉnh sửa)
                    </label>
                    <input
                      type="text"
                      value={hanNomDraft}
                      onChange={(e) => setHanNomDraft(e.target.value)}
                      placeholder="Nhập hoặc hiệu chỉnh chữ Hán/Nôm..."
                      className="w-full px-3 py-2 text-base font-hannom bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Phiên âm Hán Việt đề xuất (có thể chỉnh sửa)
                    </label>
                    <textarea
                      rows={3}
                      value={phienAmDraft}
                      onChange={(e) => setPhienAmDraft(e.target.value)}
                      className="w-full p-3 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Dịch nghĩa tham khảo (có thể chỉnh sửa)
                    </label>
                    <textarea
                      rows={3}
                      value={dichNghiaDraft}
                      onChange={(e) => setDichNghiaDraft(e.target.value)}
                      className="w-full p-3 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Ghi chú của người kiểm tra
                    </label>
                    <textarea
                      rows={2}
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Ghi chú đối chiếu thực địa, nét chữ mờ, dị thể..."
                      className="w-full p-3 text-sm bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
                    />
                  </div>
                </div>

                {authUser ? (
                  <div className="pt-3 border-t border-limestone space-y-3">
                    <p className="text-xs text-muted">
                      Đăng nhập với vai trò{' '}
                      <strong className="text-walnut-deep">{authUser.full_name} ({authUser.role})</strong>:
                      Chỉ lưu khi bạn đã đối chiếu và nhấn xác nhận thủ công.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={saveVerification}
                        onChange={(e) =>
                          setSaveVerification(
                            e.target.value as VerificationLevel
                          )
                        }
                        className="px-3 py-2 text-xs bg-white border border-limestone rounded"
                      >
                        <option value="chua_kiem_chung">
                          Lưu ở mức: Chưa kiểm chứng
                        </option>
                        <option value="da_kiem_chung">
                          Lưu ở mức: Đã kiểm chứng
                        </option>
                      </select>
                      <button
                        type="button"
                        disabled={savingAi}
                        onClick={handleSaveAiProposalToRecord}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {savingAi
                            ? 'Đang lưu...'
                            : 'Xác nhận & Lưu đề xuất vào hồ sơ'}
                        </span>
                      </button>
                    </div>
                    {saveAiNotice && (
                      <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{saveAiNotice}</span>
                      </p>
                    )}
                    {saveAiError && (
                      <p className="text-xs text-red-800">{saveAiError}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted pt-2 border-t border-limestone">
                    Kết quả AI không tự động lưu vào cơ sở dữ liệu. Quản trị viên hoặc người kiểm duyệt có thể đăng nhập để đối chiếu và lưu chính thức.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* A & G. Thông tin chung & Thông tin nguồn, quyền công bố */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
            <h2 className="text-2xl font-semibold text-walnut-deep border-b border-limestone pb-2">
              A. Thông tin chung
            </h2>
            <dl>
              <DetailRow label="Mã hồ sơ" value={record.identifier} />
              <DetailRow label="Tên tư liệu" value={record.title} />
              <DetailRow label="Tên gọi khác" value={record.ten_goi_khac} />
              <DetailRow label="Loại tư liệu" value={record.type} />
              <DetailRow
                label="Nơi lưu giữ hiện nay"
                value={record.noi_luu_giu_hien_nay}
              />
              <DetailRow
                label="Nơi lưu giữ khi ghi nhận"
                value={record.noi_luu_giu_tai_thoi_diem_tu_lieu}
              />
              <DetailRow
                label="Loại địa điểm"
                value={record.loai_dia_diem_luu_giu}
              />
              <DetailRow
                label="Đình / Chùa / Đền / Nhà thờ họ"
                value={record.ten_di_tich || record.nha_tho_ho}
              />
              <DetailRow
                label="Địa danh hành chính hiện hành"
                value={[
                  record.coverage.phuong_xa_hien_nay,
                  record.coverage.don_vi_hanh_chinh_hien_nay,
                  record.coverage.thanh_pho,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <DetailRow
                label="Địa danh hành chính lịch sử"
                value={[
                  record.coverage.phuong_xa_lich_su,
                  record.coverage.don_vi_hanh_chinh_lich_su,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <DetailRow label="Thôn / Làng" value={record.coverage.thon_lang} />
              <DetailRow
                label="Dòng họ liên quan"
                value={record.dong_ho_lien_quan}
              />
              <DetailRow
                label="Gia đình liên quan"
                value={record.gia_dinh_lien_quan}
              />
              <DetailRow label="Người tạo lập" value={record.creator} />
              <DetailRow
                label="Thời gian tạo lập (theo nguồn)"
                value={record.date || record.coverage.thoi_gian}
              />
              <DetailRow label="Định dạng / Chất liệu" value={record.format} />
              <DetailRow
                label="Tình trạng bản gốc"
                value={record.tinh_trang_ban_goc}
              />
              <DetailRow label="Số đăng ký" value={record.so_dang_ky} />
              <DetailRow label="Mô tả" value={record.description} />
              <DetailRow label="Chủ đề" value={record.subject} />
              <DetailRow label="Ngôn ngữ" value={record.language} />
              <DetailRow
                label="Người cung cấp (được phép công bố)"
                value={record.contributor}
              />
            </dl>
          </div>

          <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
            <h2 className="text-2xl font-semibold text-walnut-deep border-b border-limestone pb-2">
              G. Nguồn và quyền công bố
            </h2>
            <dl>
              <DetailRow label="Đơn vị công bố" value={record.publisher} />
              <DetailRow label="Nguồn cung cấp" value={record.source} />
              <DetailRow
                label="Người cung cấp"
                value={
                  record.contributor.length > 0
                    ? record.contributor
                    : 'Không công khai thông tin cá nhân'
                }
              />
              <DetailRow
                label="Người cho phép công bố"
                value={
                  record.nguoi_cho_phep_cong_bo || 'Đang chờ xác nhận'
                }
              />
              <DetailRow
                label="Phạm vi được phép công bố"
                value={record.pham_vi_duoc_phep || 'Chưa xác nhận phạm vi'}
              />
              <DetailRow label="Quyền sử dụng" value={record.rights} />
              <DetailRow
                label="Phần không công bố"
                value={
                  record.co_phan_khong_cong_bo
                    ? 'Hồ sơ có dữ liệu hạn chế không công bố công khai'
                    : 'Không có'
                }
              />
              <DetailRow label="Ngày tiếp nhận" value={record.ngay_tiep_nhan} />
              <DetailRow label="Ngày cập nhật" value={record.ngay_cap_nhat} />
            </dl>

            {linkedSources.length > 0 && (
              <div className="pt-3 border-t border-limestone space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Nguồn tham khảo liên kết
                </p>
                <ul className="space-y-1.5 text-sm">
                  {linkedSources.map((src) => (
                    <li key={src.ma_nguon} className="text-ink">
                      <span className="font-mono text-xs text-muted mr-2">
                        {src.ma_nguon}
                      </span>
                      <Link
                        to="/nguon-tu-lieu"
                        className="text-bronze hover:underline"
                      >
                        {src.ten_nguon}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {record.lich_su_chinh_sua &&
              record.lich_su_chinh_sua.length > 0 && (
                <div className="pt-3 border-t border-limestone space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Lịch sử chỉnh sửa
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted">
                    {record.lich_su_chinh_sua.map((item, idx) => (
                      <li key={idx}>
                        <span className="font-mono text-ink mr-2">
                          {item.ngay}
                        </span>
                        <span>{item.noi_dung}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      </section>

      <SubmissionModal
        open={editRequestOpen}
        onClose={() => setEditRequestOpen(false)}
        targetRecord={{
          identifier: record.identifier,
          title: record.title,
          noi_luu_giu_hien_nay: record.noi_luu_giu_hien_nay,
        }}
      />
    </div>
  );
}
