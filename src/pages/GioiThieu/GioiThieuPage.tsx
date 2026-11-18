import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { downloadArchiveExport } from '../../api/client.ts';

export function GioiThieuPage() {
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(format);
    setNotice(null);
    try {
      const filename = await downloadArchiveExport(format);
      setNotice({
        type: 'success',
        text: `Đã xuất thành công tệp ${filename} (chỉ bao gồm dữ liệu được phép công bố).`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: `Xuất dữ liệu ${format.toUpperCase()} thất bại. Vui lòng thử lại.`,
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div className="border-b border-limestone pb-5">
        <h1 className="text-3xl sm:text-4xl font-bold text-walnut-deep">
          Giới thiệu dự án và xuất dữ liệu
        </h1>
        <p className="text-sm text-muted mt-1.5">
          Thông tin về mục tiêu bảo tồn, nguyên tắc kiểm chứng và công cụ xuất toàn bộ cơ sở dữ liệu công bố.
        </p>
      </div>

      {/* Mandatory Attribution Block */}
      <section className="border border-bronze/40 bg-parchment/70 rounded-lg p-6 sm:p-8 space-y-4">
        <h2 className="text-2xl font-semibold text-walnut-deep">
          Thông tin thực hiện dự án
        </h2>
        <div className="space-y-3 text-base font-serif text-ink leading-relaxed">
          <p className="font-semibold text-walnut-deep">
            Sản phẩm thực tập của Trương Văn Quý, mã sinh viên PH68121, Nhóm 2, thuộc Chương trình Thực tập sinh Đợt 15 FPT Polytechnic và IMTA TECH. Đây là dự án xã hội phi lợi nhuận, hướng tới bảo tồn và phát huy giá trị di sản văn hóa truyền thống.
          </p>
          <p>
            Hệ thống hướng tới việc số hóa, lưu trữ và phát huy giá trị tư liệu hoành phi, câu đối tại các đình, chùa, đền, miếu và nhà thờ họ trên địa bàn toàn Thành phố Hà Nội.
          </p>
        </div>
      </section>

      {/* Export Section */}
      <section className="border border-limestone bg-ivory rounded-lg p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-walnut-deep">
            Xuất toàn bộ dữ liệu hồ sơ số
          </h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Xuất toàn bộ các hồ sơ được phép công bố từ{' '}
            <code className="font-mono text-xs bg-parchment px-1.5 py-0.5 rounded">
              tulieu.json
            </code>
            . Các trường không được phép công bố, thông tin cá nhân chưa xác nhận và đường dẫn ảnh riêng tư được loại bỏ tự động ở máy chủ. Tệp CSV sử dụng UTF-8 BOM để Excel hiển thị chính xác tiếng Việt có dấu và chữ Hán/Nôm.
          </p>
        </div>

        {notice && (
          <div
            className={`flex items-start gap-2.5 p-3.5 rounded border text-sm ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>
              {exporting === 'json'
                ? 'Đang xuất JSON...'
                : 'Xuất toàn bộ dữ liệu JSON'}
            </span>
          </button>

          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border border-walnut text-walnut-deep bg-ivory rounded hover:bg-parchment disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>
              {exporting === 'csv'
                ? 'Đang xuất CSV...'
                : 'Xuất toàn bộ dữ liệu CSV'}
            </span>
          </button>
        </div>
      </section>

      {/* Editorial Principles */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
          <h3 className="text-xl font-semibold text-walnut-deep">
            Mục đích và ý nghĩa số hóa
          </h3>
          <p className="text-sm text-ink/90 leading-relaxed">
            Hoành phi và câu đối tại các di tích và nhà thờ họ trên địa bàn Hà Nội mang giá trị lịch sử, ngôn ngữ Hán Nôm, nghệ thuật chạm khắc và ký ức cộng đồng sâu sắc. Việc số hóa có hệ thống giúp bảo tồn nguyên trạng hình ảnh, văn bản và xuất xứ trước nguy cơ xuống cấp theo thời gian.
          </p>
        </div>

        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
          <h3 className="text-xl font-semibold text-walnut-deep">
            Phạm vi và đối tượng tư liệu
          </h3>
          <p className="text-sm text-ink/90 leading-relaxed">
            Phạm vi bao phủ toàn bộ thành phố Hà Nội, không giới hạn ở một quận, huyện hay làng xã cụ thể. Tư liệu gồm hoành phi, câu đối và các văn bản Hán Nôm liên quan trực tiếp tại đình, chùa, đền, miếu, nhà thờ họ và từ đường.
          </p>
        </div>

        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
          <h3 className="text-xl font-semibold text-walnut-deep">
            Nguyên tắc kiểm chứng tư liệu
          </h3>
          <p className="text-sm text-ink/90 leading-relaxed">
            Mỗi hồ sơ phân loại minh bạch thành ba mức: Đã kiểm chứng, Chưa kiểm chứng và Chưa đọc được. Phiên âm Hán Việt và dịch nghĩa có trạng thái kiểm chứng độc lập. Mọi gợi ý từ Gemini AI luôn gắn nhãn chưa kiểm chứng và không tự ghi đè dữ liệu gốc.
          </p>
        </div>

        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-3">
          <h3 className="text-xl font-semibold text-walnut-deep">
            Bảo vệ quyền công bố và định hướng
          </h3>
          <p className="text-sm text-ink/90 leading-relaxed">
            Hình ảnh chỉ được công bố khi có đủ thông tin người cho phép và phạm vi công bố, được kiểm tra trực tiếp tại máy chủ. Địa danh hành chính hiện hành và địa danh lịch sử được lưu giữ song song, không tự động suy đoán hay chuyển đổi thiếu căn cứ.
          </p>
        </div>
      </section>
    </div>
  );
}
