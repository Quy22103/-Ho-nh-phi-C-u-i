import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BookOpenCheck, Send } from 'lucide-react';
import { askGeminiArchive, fetchSystemStatus } from '../../api/client.ts';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type { QAResponse } from '../../types/archive.ts';

interface QAExchange {
  id: string;
  question: string;
  timestamp: string;
  response: QAResponse;
}

const SAMPLE_QUESTIONS = [
  'Tìm các hoành phi tại nhà thờ họ ở Hà Nội.',
  'Tìm tư liệu của dòng họ Nguyễn.',
  'Những câu đối nào đã có phiên âm được kiểm chứng?',
  'Tư liệu nào đang có ảnh nhưng chưa có phiên âm?',
  'Tìm những hồ sơ có bản gốc còn nguyên vẹn?',
  'Tìm các tư liệu đang chờ kiểm chứng?',
];

export function HoiDapPage() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QAExchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSystemStatus()
      .then((res) => setGeminiConfigured(res.geminiConfigured))
      .catch(() => setGeminiConfigured(null));
  }, []);

  const submitQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    try {
      const res = await askGeminiArchive(trimmed);
      setHistory((prev) => [
        {
          id: `qa-${Date.now()}`,
          question: trimmed,
          timestamp: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          response: res,
        },
        ...prev,
      ]);
      setQuestion('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(
        msg ||
          'Không thể thực hiện truy vấn hỏi đáp lúc này. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuestion(question);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-limestone pb-5 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-walnut-deep">
          Hỏi đáp tư liệu với Gemini
        </h1>
        <p className="text-sm text-muted max-w-3xl leading-relaxed">
          Hệ thống chỉ tìm kiếm và tổng hợp câu trả lời từ dữ liệu hiện có trong{' '}
          <code className="font-mono text-xs bg-parchment px-1.5 py-0.5 rounded">
            tulieu.json
          </code>
          . Mọi câu trả lời đều phải kèm mã hồ sơ, nơi lưu giữ, loại bản và mức kiểm chứng thực tế.
        </p>
      </div>

      {geminiConfigured === false && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Chức năng Hỏi đáp AI chưa được cấu hình GEMINI_API_KEY
            </p>
            <p className="text-xs mt-1">
              Bạn vẫn có thể sử dụng đầy đủ các tính năng tra cứu danh sách, xem chi tiết hồ sơ, xem nguồn tư liệu và xuất JSON/CSV. Để kích hoạt Gemini, hãy thiết lập biến môi trường <code className="font-mono">GEMINI_API_KEY</code> phía máy chủ.
            </p>
          </div>
        </div>
      )}

      {/* Question Form */}
      <form
        onSubmit={handleSubmit}
        className="border border-limestone bg-ivory rounded-lg p-5 space-y-4"
      >
        <div>
          <label
            htmlFor="qa-question-input"
            className="block text-sm font-semibold text-walnut-deep mb-2"
          >
            Đặt câu hỏi tra cứu tư liệu Hà Nội
          </label>
          <textarea
            id="qa-question-input"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ví dụ: Đình nào có tư liệu hoành phi? Hoặc nhập tên dòng họ, địa danh, chữ Hán/Nôm..."
            className="w-full p-3.5 text-sm sm:text-base bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Gợi ý:</span>
            {SAMPLE_QUESTIONS.slice(0, 3).map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setQuestion(sample)}
                className="text-xs px-2.5 py-1 rounded border border-limestone bg-parchment/60 text-ink hover:border-bronze transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-45 transition-colors whitespace-nowrap"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? 'Đang tra cứu dữ liệu...' : 'Gửi câu hỏi'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-limestone/70">
          {SAMPLE_QUESTIONS.slice(3).map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setQuestion(sample)}
              className="text-xs px-2.5 py-1 rounded border border-limestone bg-parchment/40 text-muted hover:text-ink hover:border-bronze transition-colors"
            >
              {sample}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-900 text-sm">
          {error}
        </div>
      )}

      {/* Session Q&A History */}
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-walnut-deep">
          Kết quả và lịch sử hỏi đáp trong phiên
        </h2>

        {history.length === 0 ? (
          <div className="border border-limestone bg-parchment/40 rounded-lg p-8 text-center text-sm text-muted">
            Chưa có câu hỏi nào trong phiên làm việc hiện tại. Hãy nhập câu hỏi phía trên để tra cứu theo dữ liệu hồ sơ của dự án.
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((item) => (
              <article
                key={item.id}
                className="border border-limestone bg-ivory rounded-lg overflow-hidden"
              >
                <div className="px-5 py-3.5 bg-parchment/60 border-b border-limestone flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-walnut-deep">
                    Câu hỏi: {item.question}
                  </p>
                  <span className="text-xs font-mono text-muted shrink-0">
                    {item.timestamp}
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  <div className="text-sm sm:text-base font-serif text-ink leading-relaxed whitespace-pre-line">
                    {item.response.answer}
                  </div>

                  {item.response.citations.length > 0 && (
                    <div className="pt-4 border-t border-limestone space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <BookOpenCheck className="w-4 h-4 text-bronze" />
                        <span>
                          Hồ sơ nguồn được sử dụng để trả lời (
                          {item.response.citations.length})
                        </span>
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.response.citations.map((cit) => (
                          <div
                            key={cit.identifier}
                            className="border border-limestone bg-parchment/30 rounded p-3.5 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                to={`/tu-lieu/${encodeURIComponent(cit.identifier)}`}
                                className="font-mono font-semibold text-bronze hover:underline"
                              >
                                {cit.identifier}
                              </Link>
                              <VerificationBadge status={cit.muc_kiem_chung} />
                            </div>
                            <p className="text-sm font-semibold text-walnut-deep">
                              {cit.title}
                            </p>
                            <p className="text-muted">
                              Nơi lưu giữ hiện nay:{' '}
                              <span className="text-ink">
                                {cit.noi_luu_giu_hien_nay}
                              </span>
                            </p>
                            <p className="text-muted">
                              Loại bản đang hiển thị:{' '}
                              <span className="text-ink">
                                {cit.loai_ban_dang_hien_thi}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
