import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  commitAdminBulkImport,
  createAdminOfficialRecord,
  deleteAdminOfficialRecord,
  deleteAdminRecordImage,
  downloadArchiveExport,
  previewAdminBulkImport,
  uploadAdminRecordImages,
  updateAdminOfficialRecord,
} from '../../api/client.ts';
import type { BulkImportPreviewResponse } from '../../api/client.ts';
import { ProcessingStatusBadge } from '../../components/ProcessingStatusBadge.tsx';
import { VerificationBadge } from '../../components/VerificationBadge.tsx';
import type {
  ArchiveRecordRaw,
  GranularVerification,
  ImagePermission,
  ImageType,
  ProcessingStatus,
  UserAccountSafe,
  VerificationLevel,
} from '../../types/archive.ts';

interface Props {
  currentUser: UserAccountSafe;
  records: ArchiveRecordRaw[];
  onReload: () => void;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

function emptyNewRecordForm(canPublish: boolean) {
  return {
    identifier: '',
    title: '',
    ten_goi_khac: '',
    type: 'Hoành phi',
    creator: '',
    date: '',
    format: '',
    subject: '',
    language: 'Chữ Hán/Nôm, Tiếng Việt',
    publisher: 'Hồ sơ số Hoành phi – Câu đối Hà Nội',
    contributor: '',
    source: '',
    relation: '',
    rights: '',
    description: '',
    thanh_pho: 'Hà Nội',
    don_vi_hanh_chinh_hien_nay: '',
    don_vi_hanh_chinh_lich_su: '',
    phuong_xa_hien_nay: '',
    phuong_xa_lich_su: '',
    thon_lang: '',
    thoi_gian: '',
    noi_luu_giu_hien_nay: '',
    noi_luu_giu_tai_thoi_diem_tu_lieu: '',
    loai_dia_diem_luu_giu: 'Đình',
    ten_di_tich: '',
    dong_ho_lien_quan: '',
    gia_dinh_lien_quan: '',
    nha_tho_ho: '',
    loai_ban_dang_hien_thi: 'Ảnh bản gốc',
    tinh_trang_ban_goc: 'Còn nguyên vẹn',
    so_dang_ky: '',
    nguoi_cho_phep_cong_bo: '',
    pham_vi_duoc_phep: '',
    phan_khong_cong_bo: '',
    chu_han_nom: '',
    phien_am_noi_dung: '',
    dich_nghia_noi_dung: '',
    giai_thich_noi_dung: '',
    ghi_chu_nghien_cuu: '',
    ghi_chu: '',
    muc_kiem_chung: 'chua_kiem_chung' as VerificationLevel,
    trang_thai_xu_ly: (canPublish
      ? 'DA_CONG_KHAI'
      : 'CHO_CONG_KHAI') as ProcessingStatus,
    cong_khai_nguoi_cung_cap: false,
  };
}

export function AdminOfficialRecordsTab({
  currentUser,
  records,
  onReload,
  onNotice,
  onError,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(() =>
    emptyNewRecordForm(currentUser.can_publish)
  );
  const [creating, setCreating] = useState(false);

  const [editingRecord, setEditingRecord] = useState<ArchiveRecordRaw | null>(
    null
  );
  const [editSubjectText, setEditSubjectText] = useState('');
  const [editContributorText, setEditContributorText] = useState('');
  const [editSourceText, setEditSourceText] = useState('');
  const [editRelationText, setEditRelationText] = useState('');
  const [editGiaiThich, setEditGiaiThich] = useState('');
  const [editGhiChuNghienCuu, setEditGhiChuNghienCuu] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Direct multi-image upload state for editing record
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadImageType, setUploadImageType] =
    useState<ImageType>('toan_trang');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadSource, setUploadSource] = useState('');
  const [uploadPermission, setUploadPermission] =
    useState<ImagePermission>('cho_xac_nhan');
  const [uploadingImages, setUploadingImages] = useState(false);

  // Bulk JSON/CSV import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importContent, setImportContent] = useState('');
  const [importPreview, setImportPreview] =
    useState<BulkImportPreviewResponse | null>(null);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [committingImport, setCommittingImport] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecordRaw | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [
        r.identifier,
        r.title,
        r.ten_goi_khac || '',
        r.noi_luu_giu_hien_nay,
        r.chu_han_nom,
        r.dong_ho_lien_quan || '',
        r.ten_di_tich || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [records, searchTerm]);

  const startEditing = (r: ArchiveRecordRaw) => {
    setShowCreateForm(false);
    setShowBulkImport(false);
    setEditingRecord(structuredClone(r));
    setEditSubjectText((r.subject || []).join(', '));
    setEditContributorText((r.contributor || []).join(', '));
    setEditSourceText((r.source || []).join(', '));
    setEditRelationText((r.relation || []).join(', '));
    setEditGiaiThich(r.giai_thich_noi_dung?.noi_dung || '');
    setEditGhiChuNghienCuu(r.ghi_chu_nghien_cuu?.noi_dung || '');
    setUploadFiles([]);
    setUploadCaption(r.title);
    setUploadSource((r.source || [])[0] || '');
    onError('');
    onNotice('');
  };

  const handleCreateRecord = async (e: FormEvent) => {
    e.preventDefault();
    onError('');
    onNotice('');
    setCreating(true);
    try {
      const res = await createAdminOfficialRecord({
        identifier: createForm.identifier.trim() || undefined,
        title: createForm.title,
        ten_goi_khac: createForm.ten_goi_khac,
        type: createForm.type,
        creator: createForm.creator,
        date: createForm.date,
        format: createForm.format,
        subject: createForm.subject,
        language: createForm.language,
        publisher: createForm.publisher,
        contributor: createForm.contributor,
        source: createForm.source,
        relation: createForm.relation,
        rights: createForm.rights,
        description: createForm.description,
        coverage: {
          thanh_pho: createForm.thanh_pho,
          don_vi_hanh_chinh_hien_nay: createForm.don_vi_hanh_chinh_hien_nay,
          don_vi_hanh_chinh_lich_su: createForm.don_vi_hanh_chinh_lich_su,
          phuong_xa_hien_nay: createForm.phuong_xa_hien_nay,
          phuong_xa_lich_su: createForm.phuong_xa_lich_su,
          thon_lang: createForm.thon_lang,
          thoi_gian: createForm.thoi_gian,
        },
        noi_luu_giu_hien_nay: createForm.noi_luu_giu_hien_nay,
        noi_luu_giu_tai_thoi_diem_tu_lieu:
          createForm.noi_luu_giu_tai_thoi_diem_tu_lieu,
        loai_dia_diem_luu_giu: createForm.loai_dia_diem_luu_giu,
        ten_di_tich: createForm.ten_di_tich,
        dong_ho_lien_quan: createForm.dong_ho_lien_quan,
        gia_dinh_lien_quan: createForm.gia_dinh_lien_quan,
        nha_tho_ho: createForm.nha_tho_ho,
        loai_ban_dang_hien_thi: createForm.loai_ban_dang_hien_thi,
        tinh_trang_ban_goc: createForm.tinh_trang_ban_goc,
        so_dang_ky: createForm.so_dang_ky,
        nguoi_cho_phep_cong_bo: createForm.nguoi_cho_phep_cong_bo,
        pham_vi_duoc_phep: createForm.pham_vi_duoc_phep,
        phan_khong_cong_bo: createForm.phan_khong_cong_bo,
        chu_han_nom: createForm.chu_han_nom,
        phien_am_noi_dung: createForm.phien_am_noi_dung,
        dich_nghia_noi_dung: createForm.dich_nghia_noi_dung,
        giai_thich_noi_dung: createForm.giai_thich_noi_dung,
        ghi_chu_nghien_cuu: createForm.ghi_chu_nghien_cuu,
        ghi_chu: createForm.ghi_chu,
        muc_kiem_chung: createForm.muc_kiem_chung,
        trang_thai_xu_ly: createForm.trang_thai_xu_ly,
        cong_khai_nguoi_cung_cap: createForm.cong_khai_nguoi_cung_cap,
      });
      onNotice(`Đã tạo mới hồ sơ ${res.record.identifier}.`);
      setCreateForm(emptyNewRecordForm(currentUser.can_publish));
      setShowCreateForm(false);
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể tạo hồ sơ chính thức mới.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveOfficialRecord = async () => {
    if (!editingRecord) return;
    onError('');
    onNotice('');
    setSavingEdit(true);
    try {
      await updateAdminOfficialRecord(editingRecord.identifier, {
        title: editingRecord.title,
        ten_goi_khac: editingRecord.ten_goi_khac,
        type: editingRecord.type,
        creator: editingRecord.creator,
        date: editingRecord.date,
        format: editingRecord.format,
        subject: editSubjectText,
        language: editingRecord.language,
        publisher: editingRecord.publisher,
        contributor: editContributorText,
        source: editSourceText,
        relation: editRelationText,
        rights: editingRecord.rights,
        description: editingRecord.description,
        coverage: editingRecord.coverage,
        noi_luu_giu_hien_nay: editingRecord.noi_luu_giu_hien_nay,
        noi_luu_giu_tai_thoi_diem_tu_lieu:
          editingRecord.noi_luu_giu_tai_thoi_diem_tu_lieu,
        loai_dia_diem_luu_giu: editingRecord.loai_dia_diem_luu_giu,
        ten_di_tich: editingRecord.ten_di_tich,
        dong_ho_lien_quan: editingRecord.dong_ho_lien_quan,
        gia_dinh_lien_quan: editingRecord.gia_dinh_lien_quan,
        nha_tho_ho: editingRecord.nha_tho_ho,
        loai_ban_dang_hien_thi: editingRecord.loai_ban_dang_hien_thi,
        tinh_trang_ban_goc: editingRecord.tinh_trang_ban_goc,
        so_dang_ky: editingRecord.so_dang_ky,
        nguoi_cho_phep_cong_bo: editingRecord.nguoi_cho_phep_cong_bo,
        pham_vi_duoc_phep: editingRecord.pham_vi_duoc_phep,
        phan_khong_cong_bo: editingRecord.phan_khong_cong_bo,
        cong_khai_nguoi_cung_cap: editingRecord.cong_khai_nguoi_cung_cap,
        chu_han_nom: editingRecord.chu_han_nom,
        phien_am_noi_dung: editingRecord.phien_am.noi_dung,
        dich_nghia_noi_dung: editingRecord.dich_nghia.noi_dung,
        giai_thich_noi_dung: editGiaiThich,
        ghi_chu_nghien_cuu: editGhiChuNghienCuu,
        ghi_chu: editingRecord.ghi_chu,
        muc_kiem_chung: editingRecord.muc_kiem_chung,
        kiem_chung_chi_tiet: editingRecord.kiem_chung_chi_tiet,
        trang_thai_xu_ly: editingRecord.trang_thai_xu_ly || 'DA_CONG_KHAI',
        images: editingRecord.images,
      });
      onNotice(`Đã cập nhật hồ sơ ${editingRecord.identifier}.`);
      setEditingRecord(null);
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể cập nhật hồ sơ chính thức.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUploadImages = async () => {
    if (!editingRecord || uploadFiles.length === 0) return;
    onError('');
    onNotice('');
    setUploadingImages(true);
    try {
      const res = await uploadAdminRecordImages(
        editingRecord.identifier,
        uploadFiles,
        {
          image_type: uploadImageType,
          caption: uploadCaption,
          source: uploadSource,
          permission: uploadPermission,
        }
      );
      setEditingRecord(res.record);
      setUploadFiles([]);
      onNotice(
        `Đã tải lên ${uploadFiles.length} ảnh cho hồ sơ ${editingRecord.identifier} (đã tạo bản hiển thị thu nhỏ).`
      );
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể tải ảnh lên hồ sơ.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!editingRecord) return;
    onError('');
    onNotice('');
    try {
      const res = await deleteAdminRecordImage(
        editingRecord.identifier,
        imageId
      );
      setEditingRecord(res.record);
      onNotice(`Đã xóa ảnh ${imageId} khỏi hồ sơ ${editingRecord.identifier}.`);
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể xóa ảnh.');
    }
  };

  const handleBulkFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportContent(text);
    setImportFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
    setImportPreview(null);
  };

  const handlePreviewBulkImport = async () => {
    onError('');
    onNotice('');
    setPreviewingImport(true);
    try {
      const res = await previewAdminBulkImport(importFormat, importContent);
      setImportPreview(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể kiểm tra cấu trúc dữ liệu nhập.');
    } finally {
      setPreviewingImport(false);
    }
  };

  const handleCommitBulkImport = async () => {
    onError('');
    onNotice('');
    setCommittingImport(true);
    try {
      const res = await commitAdminBulkImport(importFormat, importContent);
      onNotice(
        `Đã nhập thành công ${res.importedCount} hồ sơ mới${res.skippedCount > 0 ? ` (bỏ qua ${res.skippedCount} dòng lỗi)` : ''}.`
      );
      setImportPreview(null);
      setImportContent('');
      setShowBulkImport(false);
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể lưu dữ liệu nhập vào hệ thống.');
    } finally {
      setCommittingImport(false);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!deleteTarget) return;
    onError('');
    onNotice('');
    setDeleting(true);
    try {
      await deleteAdminOfficialRecord(deleteTarget.identifier);
      onNotice(`Đã xóa hồ sơ ${deleteTarget.identifier}.`);
      setDeleteTarget(null);
      if (editingRecord?.identifier === deleteTarget.identifier) {
        setEditingRecord(null);
      }
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError(msg || 'Không thể xóa hồ sơ.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportBackup = async (format: 'json' | 'csv') => {
    onError('');
    try {
      const filename = await downloadArchiveExport(format);
      onNotice(`Đã xuất tệp sao lưu công khai: ${filename}`);
    } catch {
      onError('Không thể xuất dữ liệu sao lưu.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-walnut-deep">
          Quản lý hồ sơ chính thức (tulieu.json)
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setShowBulkImport(false);
              setShowCreateForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bản ghi mới</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setShowCreateForm(false);
              setShowBulkImport((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold border border-bronze text-bronze bg-ivory rounded hover:bg-parchment"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Nhập JSON / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportBackup('json')}
            className="inline-flex items-center gap-1 px-3 py-2 border border-limestone bg-ivory rounded hover:bg-parchment"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất JSON</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportBackup('csv')}
            className="inline-flex items-center gap-1 px-3 py-2 border border-limestone bg-ivory rounded hover:bg-parchment"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Bulk JSON/CSV Import Panel */}
      {showBulkImport && (
        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-limestone pb-3">
            <div>
              <h3 className="text-lg font-semibold text-walnut-deep">
                Nhập dữ liệu hàng loạt (JSON / CSV)
              </h3>
              <p className="text-muted mt-0.5">
                Hệ thống kiểm tra cấu trúc, trường bắt buộc (tên tư liệu, nơi lưu giữ hiện nay) và trùng lặp mã định danh trước khi lưu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkImport(false)}
              className="text-muted hover:text-ink"
            >
              Đóng
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={importFormat}
              onChange={(e) => {
                setImportFormat(e.target.value as 'json' | 'csv');
                setImportPreview(null);
              }}
              className="px-3 py-2 bg-white border border-limestone rounded"
            >
              <option value="json">Định dạng JSON</option>
              <option value="csv">Định dạng CSV (UTF-8)</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-limestone bg-parchment/50 rounded cursor-pointer hover:bg-parchment">
              <Upload className="w-3.5 h-3.5" />
              <span>Chọn tệp .json hoặc .csv</span>
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={handleBulkFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            rows={7}
            value={importContent}
            onChange={(e) => {
              setImportContent(e.target.value);
              setImportPreview(null);
            }}
            placeholder={
              importFormat === 'json'
                ? 'Dán mảng JSON các hồ sơ hoặc đối tượng { "records": [...] }...'
                : 'Dán nội dung CSV có dòng tiêu đề (identifier,title,type,noi_luu_giu_hien_nay,...)'
            }
            className="w-full p-3 font-mono text-[11px] bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!importContent.trim() || previewingImport}
              onClick={handlePreviewBulkImport}
              className="px-4 py-2 font-semibold bg-bronze text-ivory rounded hover:bg-walnut disabled:opacity-50"
            >
              {previewingImport
                ? 'Đang kiểm tra...'
                : 'Kiểm tra & Xem trước dữ liệu'}
            </button>

            {importPreview && importPreview.validRecords.length > 0 && (
              <button
                type="button"
                disabled={committingImport}
                onClick={handleCommitBulkImport}
                className="px-4 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50"
              >
                {committingImport
                  ? 'Đang nhập...'
                  : `Xác nhận lưu ${importPreview.validRecords.length} bản ghi hợp lệ`}
              </button>
            )}
          </div>

          {importPreview && (
            <div className="space-y-4 pt-3 border-t border-limestone">
              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  Tổng số dòng kiểm tra:{' '}
                  <strong className="font-mono">{importPreview.totalRows}</strong>
                </span>
                <span className="text-emerald-800">
                  Hợp lệ:{' '}
                  <strong className="font-mono">
                    {importPreview.validRecords.length}
                  </strong>
                </span>
                <span className="text-red-800">
                  Lỗi / Bỏ qua:{' '}
                  <strong className="font-mono">
                    {importPreview.errors.length}
                  </strong>
                </span>
                {importPreview.duplicateIdentifiers.length > 0 && (
                  <span className="text-amber-900">
                    Mã trùng:{' '}
                    <strong className="font-mono">
                      {importPreview.duplicateIdentifiers.join(', ')}
                    </strong>
                  </span>
                )}
              </div>

              {importPreview.errors.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded p-3 space-y-1.5">
                  <p className="font-semibold text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Chi tiết dòng không hợp lệ</span>
                  </p>
                  <ul className="space-y-1 text-red-900">
                    {importPreview.errors.map((err, idx) => (
                      <li key={idx}>
                        Dòng {err.row} ({err.identifier}): {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.validRecords.length > 0 && (
                <div className="border border-limestone rounded overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-parchment border-b border-limestone text-muted uppercase">
                        <th className="py-2 px-3">Mã định danh</th>
                        <th className="py-2 px-3">Tên tư liệu</th>
                        <th className="py-2 px-3">Loại</th>
                        <th className="py-2 px-3">Nơi lưu giữ hiện nay</th>
                        <th className="py-2 px-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-limestone bg-white">
                      {importPreview.validRecords.slice(0, 20).map((rec) => (
                        <tr key={rec.identifier}>
                          <td className="py-2 px-3 font-mono">
                            {rec.identifier}
                          </td>
                          <td className="py-2 px-3 font-medium">{rec.title}</td>
                          <td className="py-2 px-3">{rec.type}</td>
                          <td className="py-2 px-3">
                            {rec.noi_luu_giu_hien_nay}
                          </td>
                          <td className="py-2 px-3">
                            <ProcessingStatusBadge
                              status={rec.trang_thai_xu_ly || 'CHO_CONG_KHAI'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create New Official Record Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateRecord}
          className="border border-limestone bg-ivory rounded-lg p-6 space-y-5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-limestone pb-3">
            <h3 className="text-xl font-semibold text-walnut-deep">
              Thêm bản ghi tư liệu mới (15 trường Dublin Core & trường mở rộng)
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-muted hover:text-ink"
            >
              Hủy
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">
                Mã định danh (tự sinh nếu để trống)
              </label>
              <input
                type="text"
                value={createForm.identifier}
                onChange={(e) =>
                  setCreateForm({ ...createForm, identifier: e.target.value })
                }
                placeholder="VD: HN-HP-001"
                className="w-full px-3 py-2 bg-white border border-limestone rounded font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên tư liệu *</label>
              <input
                type="text"
                required
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm({ ...createForm, title: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên gọi khác</label>
              <input
                type="text"
                value={createForm.ten_goi_khac}
                onChange={(e) =>
                  setCreateForm({ ...createForm, ten_goi_khac: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Loại tư liệu</label>
              <select
                value={createForm.type}
                onChange={(e) =>
                  setCreateForm({ ...createForm, type: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Hoành phi">Hoành phi</option>
                <option value="Câu đối">Câu đối</option>
                <option value="Tư liệu khác">Tư liệu khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nơi lưu giữ hiện nay *
              </label>
              <input
                type="text"
                required
                value={createForm.noi_luu_giu_hien_nay}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    noi_luu_giu_hien_nay: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nơi lưu giữ tại thời điểm tư liệu
              </label>
              <input
                type="text"
                value={createForm.noi_luu_giu_tai_thoi_diem_tu_lieu}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    noi_luu_giu_tai_thoi_diem_tu_lieu: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Loại địa điểm</label>
              <select
                value={createForm.loai_dia_diem_luu_giu}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    loai_dia_diem_luu_giu: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Đình">Đình</option>
                <option value="Chùa">Chùa</option>
                <option value="Đền">Đền</option>
                <option value="Miếu">Miếu</option>
                <option value="Nhà thờ họ">Nhà thờ họ</option>
                <option value="Từ đường">Từ đường</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên di tích</label>
              <input
                type="text"
                value={createForm.ten_di_tich}
                onChange={(e) =>
                  setCreateForm({ ...createForm, ten_di_tich: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Dòng họ liên quan
              </label>
              <input
                type="text"
                value={createForm.dong_ho_lien_quan}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    dong_ho_lien_quan: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Gia đình liên quan
              </label>
              <input
                type="text"
                value={createForm.gia_dinh_lien_quan}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    gia_dinh_lien_quan: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nhà thờ họ</label>
              <input
                type="text"
                value={createForm.nha_tho_ho}
                onChange={(e) =>
                  setCreateForm({ ...createForm, nha_tho_ho: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phường/Xã hiện nay
              </label>
              <input
                type="text"
                value={createForm.phuong_xa_hien_nay}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    phuong_xa_hien_nay: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Quận/Huyện lịch sử
              </label>
              <input
                type="text"
                value={createForm.don_vi_hanh_chinh_lich_su}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    don_vi_hanh_chinh_lich_su: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phường/Xã lịch sử
              </label>
              <input
                type="text"
                value={createForm.phuong_xa_lich_su}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    phuong_xa_lich_su: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Thôn / Làng</label>
              <input
                type="text"
                value={createForm.thon_lang}
                onChange={(e) =>
                  setCreateForm({ ...createForm, thon_lang: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Người tạo lập</label>
              <input
                type="text"
                value={createForm.creator}
                onChange={(e) =>
                  setCreateForm({ ...createForm, creator: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Niên đại / Thời gian tạo lập
              </label>
              <input
                type="text"
                value={createForm.date}
                onChange={(e) =>
                  setCreateForm({ ...createForm, date: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Chất liệu / Định dạng
              </label>
              <input
                type="text"
                value={createForm.format}
                onChange={(e) =>
                  setCreateForm({ ...createForm, format: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Loại bản đang hiển thị
              </label>
              <select
                value={createForm.loai_ban_dang_hien_thi}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    loai_ban_dang_hien_thi: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Ảnh bản gốc">Ảnh bản gốc</option>
                <option value="Bản chụp">Bản chụp</option>
                <option value="Ảnh bản dập">Ảnh bản dập</option>
                <option value="Bản sao">Bản sao</option>
                <option value="Bản phục chế">Bản phục chế</option>
                <option value="Bản phiên âm">Bản phiên âm</option>
                <option value="Bản dịch">Bản dịch</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Tình trạng bản gốc
              </label>
              <select
                value={createForm.tinh_trang_ban_goc}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    tinh_trang_ban_goc: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Còn nguyên vẹn">Còn nguyên vẹn</option>
                <option value="Hư hỏng">Hư hỏng</option>
                <option value="Mất một phần">Mất một phần</option>
                <option value="Không còn bản gốc">Không còn bản gốc</option>
                <option value="Không xác định">Không xác định</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Số đăng ký</label>
              <input
                type="text"
                value={createForm.so_dang_ky}
                onChange={(e) =>
                  setCreateForm({ ...createForm, so_dang_ky: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Chủ đề (phân tách dấu phẩy)
              </label>
              <input
                type="text"
                value={createForm.subject}
                onChange={(e) =>
                  setCreateForm({ ...createForm, subject: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nguồn (phân tách dấu phẩy)
              </label>
              <input
                type="text"
                value={createForm.source}
                onChange={(e) =>
                  setCreateForm({ ...createForm, source: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Người cung cấp (phân tách dấu phẩy)
              </label>
              <input
                type="text"
                value={createForm.contributor}
                onChange={(e) =>
                  setCreateForm({ ...createForm, contributor: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Người cho phép công bố
              </label>
              <input
                type="text"
                value={createForm.nguoi_cho_phep_cong_bo}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    nguoi_cho_phep_cong_bo: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phạm vi được phép công bố
              </label>
              <input
                type="text"
                value={createForm.pham_vi_duoc_phep}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    pham_vi_duoc_phep: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phần không công bố (nội bộ)
              </label>
              <input
                type="text"
                value={createForm.phan_khong_cong_bo}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    phan_khong_cong_bo: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Quyền sử dụng (rights)
              </label>
              <input
                type="text"
                value={createForm.rights}
                onChange={(e) =>
                  setCreateForm({ ...createForm, rights: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Mức kiểm chứng tổng thể
              </label>
              <select
                value={createForm.muc_kiem_chung}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    muc_kiem_chung: e.target.value as VerificationLevel,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                <option value="da_kiem_chung">Đã kiểm chứng</option>
                <option value="chua_doc_duoc">Chưa đọc được</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Trạng thái xử lý
              </label>
              <select
                value={createForm.trang_thai_xu_ly}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    trang_thai_xu_ly: e.target.value as ProcessingStatus,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="DA_XAC_NHAN">DA_XAC_NHAN</option>
                <option value="CHO_CONG_KHAI">CHO_CONG_KHAI</option>
                {currentUser.can_publish && (
                  <option value="DA_CONG_KHAI">DA_CONG_KHAI</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">
                Chữ Hán/Nôm nguyên bản
              </label>
              <textarea
                rows={2}
                value={createForm.chu_han_nom}
                onChange={(e) =>
                  setCreateForm({ ...createForm, chu_han_nom: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded font-hannom text-base"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phiên âm Hán Việt
              </label>
              <textarea
                rows={2}
                value={createForm.phien_am_noi_dung}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    phien_am_noi_dung: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Dịch nghĩa tiếng Việt
              </label>
              <textarea
                rows={2}
                value={createForm.dich_nghia_noi_dung}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    dich_nghia_noi_dung: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Mô tả chi tiết</label>
              <textarea
                rows={2}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Giải thích nội dung
              </label>
              <textarea
                rows={2}
                value={createForm.giai_thich_noi_dung}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    giai_thich_noi_dung: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Ghi chú chung</label>
              <textarea
                rows={2}
                value={createForm.ghi_chu}
                onChange={(e) =>
                  setCreateForm({ ...createForm, ghi_chu: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-limestone">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.cong_khai_nguoi_cung_cap}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    cong_khai_nguoi_cung_cap: e.target.checked,
                  })
                }
              />
              <span>Cho phép công khai tên người cung cấp</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-limestone rounded"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50"
              >
                {creating ? 'Đang lưu...' : 'Tạo hồ sơ mới'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Official Record Form */}
      {editingRecord ? (
        <div className="border border-limestone bg-ivory rounded-lg p-6 space-y-5 text-xs">
          <div className="flex items-center justify-between border-b border-limestone pb-3">
            <h3 className="text-xl font-semibold text-walnut-deep">
              Chỉnh sửa hồ sơ: {editingRecord.identifier}
            </h3>
            <button
              type="button"
              onClick={() => setEditingRecord(null)}
              className="text-muted hover:text-ink"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tên tư liệu</label>
              <input
                type="text"
                value={editingRecord.title}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, title: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên gọi khác</label>
              <input
                type="text"
                value={editingRecord.ten_goi_khac || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    ten_goi_khac: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Loại tư liệu</label>
              <select
                value={editingRecord.type}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, type: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Hoành phi">Hoành phi</option>
                <option value="Câu đối">Câu đối</option>
                <option value="Tư liệu khác">Tư liệu khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nơi lưu giữ hiện nay
              </label>
              <input
                type="text"
                value={editingRecord.noi_luu_giu_hien_nay}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    noi_luu_giu_hien_nay: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nơi lưu giữ tại thời điểm tư liệu
              </label>
              <input
                type="text"
                value={editingRecord.noi_luu_giu_tai_thoi_diem_tu_lieu}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    noi_luu_giu_tai_thoi_diem_tu_lieu: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Loại địa điểm</label>
              <select
                value={editingRecord.loai_dia_diem_luu_giu || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    loai_dia_diem_luu_giu: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="">-- Chọn loại địa điểm --</option>
                <option value="Đình">Đình</option>
                <option value="Chùa">Chùa</option>
                <option value="Đền">Đền</option>
                <option value="Miếu">Miếu</option>
                <option value="Nhà thờ họ">Nhà thờ họ</option>
                <option value="Từ đường">Từ đường</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên di tích</label>
              <input
                type="text"
                value={editingRecord.ten_di_tich || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    ten_di_tich: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Dòng họ liên quan
              </label>
              <input
                type="text"
                value={editingRecord.dong_ho_lien_quan || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    dong_ho_lien_quan: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Gia đình liên quan
              </label>
              <input
                type="text"
                value={editingRecord.gia_dinh_lien_quan || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    gia_dinh_lien_quan: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nhà thờ họ</label>
              <input
                type="text"
                value={editingRecord.nha_tho_ho || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    nha_tho_ho: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phường/Xã hiện nay
              </label>
              <input
                type="text"
                value={editingRecord.coverage?.phuong_xa_hien_nay || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    coverage: {
                      ...editingRecord.coverage,
                      phuong_xa_hien_nay: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Quận/Huyện lịch sử
              </label>
              <input
                type="text"
                value={editingRecord.coverage?.don_vi_hanh_chinh_lich_su || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    coverage: {
                      ...editingRecord.coverage,
                      don_vi_hanh_chinh_lich_su: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phường/Xã lịch sử
              </label>
              <input
                type="text"
                value={editingRecord.coverage?.phuong_xa_lich_su || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    coverage: {
                      ...editingRecord.coverage,
                      phuong_xa_lich_su: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Thôn / Làng</label>
              <input
                type="text"
                value={editingRecord.coverage?.thon_lang || ''}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    coverage: {
                      ...editingRecord.coverage,
                      thon_lang: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Người tạo lập</label>
              <input
                type="text"
                value={editingRecord.creator}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, creator: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Niên đại / Thời gian tạo lập
              </label>
              <input
                type="text"
                value={editingRecord.date}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, date: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Chất liệu / Định dạng
              </label>
              <input
                type="text"
                value={editingRecord.format}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, format: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Loại bản đang hiển thị
              </label>
              <select
                value={editingRecord.loai_ban_dang_hien_thi}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    loai_ban_dang_hien_thi: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Ảnh bản gốc">Ảnh bản gốc</option>
                <option value="Bản chụp">Bản chụp</option>
                <option value="Ảnh bản dập">Ảnh bản dập</option>
                <option value="Bản sao">Bản sao</option>
                <option value="Bản phục chế">Bản phục chế</option>
                <option value="Bản phiên âm">Bản phiên âm</option>
                <option value="Bản dịch">Bản dịch</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Tình trạng bản gốc
              </label>
              <select
                value={editingRecord.tinh_trang_ban_goc}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    tinh_trang_ban_goc: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="Còn nguyên vẹn">Còn nguyên vẹn</option>
                <option value="Hư hỏng">Hư hỏng</option>
                <option value="Mất một phần">Mất một phần</option>
                <option value="Không còn bản gốc">Không còn bản gốc</option>
                <option value="Không xác định">Không xác định</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Số đăng ký</label>
              <input
                type="text"
                value={editingRecord.so_dang_ky}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    so_dang_ky: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Trạng thái xử lý / công khai
              </label>
              <select
                value={editingRecord.trang_thai_xu_ly || 'DA_CONG_KHAI'}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    trang_thai_xu_ly: e.target.value as ProcessingStatus,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="DA_XAC_NHAN">DA_XAC_NHAN</option>
                <option value="CHO_CONG_KHAI">CHO_CONG_KHAI</option>
                {currentUser.can_publish && (
                  <option value="DA_CONG_KHAI">DA_CONG_KHAI</option>
                )}
                <option value="TU_CHOI">TU_CHOI (ẩn khỏi công khai)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Mức kiểm chứng tổng thể
              </label>
              <select
                value={editingRecord.muc_kiem_chung}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    muc_kiem_chung: e.target.value as VerificationLevel,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              >
                <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                <option value="da_kiem_chung">Đã kiểm chứng</option>
                <option value="chua_doc_duoc">Chưa đọc được</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Người cho phép công bố
              </label>
              <input
                type="text"
                value={editingRecord.nguoi_cho_phep_cong_bo}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    nguoi_cho_phep_cong_bo: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phạm vi được phép công bố
              </label>
              <input
                type="text"
                value={editingRecord.pham_vi_duoc_phep}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    pham_vi_duoc_phep: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phần không công bố (nội bộ)
              </label>
              <input
                type="text"
                value={editingRecord.phan_khong_cong_bo}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    phan_khong_cong_bo: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Chủ đề (dấu phẩy)
              </label>
              <input
                type="text"
                value={editSubjectText}
                onChange={(e) => setEditSubjectText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Nguồn (dấu phẩy)
              </label>
              <input
                type="text"
                value={editSourceText}
                onChange={(e) => setEditSourceText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Người cung cấp (dấu phẩy)
              </label>
              <input
                type="text"
                value={editContributorText}
                onChange={(e) => setEditContributorText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Liên kết hồ sơ (dấu phẩy)
              </label>
              <input
                type="text"
                value={editRelationText}
                onChange={(e) => setEditRelationText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Quyền sử dụng</label>
              <input
                type="text"
                value={editingRecord.rights}
                onChange={(e) =>
                  setEditingRecord({ ...editingRecord, rights: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-limestone">
            <div>
              <label className="block font-semibold mb-1">
                Chữ Hán/Nôm nguyên bản
              </label>
              <textarea
                rows={2}
                value={editingRecord.chu_han_nom}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    chu_han_nom: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded font-hannom text-base"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Phiên âm Hán Việt
              </label>
              <textarea
                rows={2}
                value={editingRecord.phien_am.noi_dung}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    phien_am: {
                      ...editingRecord.phien_am,
                      noi_dung: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Dịch nghĩa tiếng Việt
              </label>
              <textarea
                rows={2}
                value={editingRecord.dich_nghia.noi_dung}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    dich_nghia: {
                      ...editingRecord.dich_nghia,
                      noi_dung: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Mô tả chi tiết</label>
              <textarea
                rows={2}
                value={editingRecord.description}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Giải thích nội dung
              </label>
              <textarea
                rows={2}
                value={editGiaiThich}
                onChange={(e) => setEditGiaiThich(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Ghi chú nghiên cứu / Ghi chú chung
              </label>
              <textarea
                rows={2}
                value={editGhiChuNghienCuu}
                onChange={(e) => setEditGhiChuNghienCuu(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-limestone rounded"
              />
            </div>
          </div>

          {/* Granular verification */}
          <div className="pt-3 border-t border-limestone space-y-2">
            <p className="font-semibold text-walnut-deep">Kiểm chứng từng phần</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ['dia_diem', 'Địa điểm'],
                  ['nguon_tu_lieu', 'Nguồn tư liệu'],
                  ['chu_han_nom', 'Chữ Hán/Nôm'],
                  ['phien_am', 'Phiên âm'],
                  ['dich_nghia', 'Dịch nghĩa'],
                  ['nien_dai', 'Niên đại'],
                ] as Array<[keyof GranularVerification, string]>
              ).map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-muted mb-1">{lbl}</label>
                  <select
                    value={
                      editingRecord.kiem_chung_chi_tiet?.[k] || 'chua_kiem_chung'
                    }
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        kiem_chung_chi_tiet: {
                          dia_diem:
                            editingRecord.kiem_chung_chi_tiet?.dia_diem ||
                            'chua_kiem_chung',
                          nguon_tu_lieu:
                            editingRecord.kiem_chung_chi_tiet?.nguon_tu_lieu ||
                            'chua_kiem_chung',
                          chu_han_nom:
                            editingRecord.kiem_chung_chi_tiet?.chu_han_nom ||
                            'chua_kiem_chung',
                          phien_am:
                            editingRecord.kiem_chung_chi_tiet?.phien_am ||
                            'chua_kiem_chung',
                          dich_nghia:
                            editingRecord.kiem_chung_chi_tiet?.dich_nghia ||
                            'chua_kiem_chung',
                          nien_dai:
                            editingRecord.kiem_chung_chi_tiet?.nien_dai ||
                            'chua_kiem_chung',
                          [k]: e.target.value as VerificationLevel,
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-limestone rounded"
                  >
                    <option value="chua_kiem_chung">Chưa kiểm chứng</option>
                    <option value="da_kiem_chung">Đã kiểm chứng</option>
                    <option value="chua_doc_duoc">Chưa đọc được</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Multi-Image Upload & Management */}
          <div className="pt-3 border-t border-limestone space-y-4">
            <p className="font-semibold text-walnut-deep flex items-center gap-1.5">
              <ImagePlus className="w-4 h-4 text-bronze" />
              <span>
                Quản lý hình ảnh hồ sơ ({editingRecord.images.length})
              </span>
            </p>

            {/* Upload new images directly */}
            <div className="p-4 border border-limestone bg-parchment/40 rounded space-y-3">
              <p className="font-semibold text-ink">
                Tải thêm ảnh mới cho hồ sơ (tự động nén bản hiển thị thu nhỏ)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <select
                  value={uploadImageType}
                  onChange={(e) =>
                    setUploadImageType(e.target.value as ImageType)
                  }
                  className="px-2.5 py-1.5 bg-white border border-limestone rounded"
                >
                  <option value="toan_trang">Toàn cảnh</option>
                  <option value="can_canh">Cận cảnh</option>
                  <option value="can_canh_trai">Vế trái</option>
                  <option value="can_canh_phai">Vế phải</option>
                  <option value="can_canh_chu">Cận cảnh chữ</option>
                  <option value="ban_dap">Bản dập</option>
                  <option value="ban_sao">Bản sao</option>
                  <option value="khac">Khác</option>
                </select>
                <input
                  type="text"
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Chú thích ảnh..."
                  className="px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
                <input
                  type="text"
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                  placeholder="Nguồn ảnh..."
                  className="px-2.5 py-1.5 bg-white border border-limestone rounded"
                />
                <select
                  value={uploadPermission}
                  onChange={(e) =>
                    setUploadPermission(e.target.value as ImagePermission)
                  }
                  className="px-2.5 py-1.5 bg-white border border-limestone rounded"
                >
                  <option value="cho_xac_nhan">Chờ xác nhận</option>
                  <option value="duoc_phep_cong_bo">Được phép công bố</option>
                  <option value="khong_cong_bo">Không công bố</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) =>
                    setUploadFiles(
                      e.target.files ? Array.from(e.target.files) : []
                    )
                  }
                  className="text-xs"
                />
                <button
                  type="button"
                  disabled={uploadFiles.length === 0 || uploadingImages}
                  onClick={handleUploadImages}
                  className="px-3.5 py-1.5 font-semibold bg-bronze text-ivory rounded hover:bg-walnut disabled:opacity-50"
                >
                  {uploadingImages
                    ? 'Đang tải ảnh...'
                    : `Tải lên ${uploadFiles.length || ''} ảnh`}
                </button>
              </div>
            </div>

            {editingRecord.images.length > 0 && (
              <div className="space-y-2">
                {editingRecord.images.map((im) => (
                  <div
                    key={im.image_id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 border border-limestone rounded bg-parchment/30"
                  >
                    <span className="md:col-span-2 font-mono truncate">
                      {im.image_id}
                    </span>
                    <select
                      value={im.image_type}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          images: editingRecord.images.map((item) =>
                            item.image_id === im.image_id
                              ? {
                                  ...item,
                                  image_type: e.target.value as ImageType,
                                }
                              : item
                          ),
                        })
                      }
                      className="md:col-span-2 px-2 py-1 bg-white border border-limestone rounded"
                    >
                      <option value="toan_trang">Toàn cảnh</option>
                      <option value="can_canh">Cận cảnh</option>
                      <option value="can_canh_trai">Vế trái</option>
                      <option value="can_canh_phai">Vế phải</option>
                      <option value="can_canh_chu">Cận cảnh chữ</option>
                      <option value="ban_dap">Bản dập</option>
                      <option value="ban_sao">Bản sao</option>
                      <option value="khac">Khác</option>
                    </select>
                    <input
                      type="text"
                      value={im.caption}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          images: editingRecord.images.map((item) =>
                            item.image_id === im.image_id
                              ? { ...item, caption: e.target.value }
                              : item
                          ),
                        })
                      }
                      placeholder="Chú thích"
                      className="md:col-span-3 px-2 py-1 bg-white border border-limestone rounded"
                    />
                    <input
                      type="text"
                      value={im.source}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          images: editingRecord.images.map((item) =>
                            item.image_id === im.image_id
                              ? { ...item, source: e.target.value }
                              : item
                          ),
                        })
                      }
                      placeholder="Nguồn ảnh"
                      className="md:col-span-2 px-2 py-1 bg-white border border-limestone rounded"
                    />
                    <select
                      value={im.permission}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          images: editingRecord.images.map((item) =>
                            item.image_id === im.image_id
                              ? {
                                  ...item,
                                  permission: e.target.value as ImagePermission,
                                }
                              : item
                          ),
                        })
                      }
                      className="md:col-span-2 px-2 py-1 bg-white border border-limestone rounded"
                    >
                      <option value="cho_xac_nhan">Chờ xác nhận</option>
                      <option value="duoc_phep_cong_bo">
                        Được phép công bố
                      </option>
                      <option value="khong_cong_bo">Không công bố</option>
                    </select>
                    <div className="md:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(im.image_id)}
                        className="inline-flex items-center gap-1 text-red-700 hover:underline"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-limestone">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(editingRecord.cong_khai_nguoi_cung_cap)}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    cong_khai_nguoi_cung_cap: e.target.checked,
                  })
                }
              />
              <span>Cho phép công khai tên người cung cấp</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 border border-limestone rounded"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveOfficialRecord}
                className="px-5 py-2 font-semibold bg-walnut text-ivory rounded hover:bg-walnut-deep disabled:opacity-50"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm nhanh theo mã hồ sơ, tên tư liệu, nơi lưu giữ, chữ Hán/Nôm hoặc dòng họ..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-limestone rounded focus:outline-none focus:border-bronze"
            />
          </div>

          {/* Delete Confirmation Modal */}
          {deleteTarget && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-red-950">
                  Xác nhận xóa hồ sơ {deleteTarget.identifier} — “{deleteTarget.title}”?
                </p>
                <p className="text-red-900 mt-0.5">
                  Hành động này sẽ xóa hồ sơ khỏi dữ liệu chính thức và được ghi nhận vào nhật ký bất biến.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 border border-red-300 bg-white rounded text-red-900"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDeleteRecord}
                  className="px-3.5 py-1.5 font-semibold bg-red-800 text-white rounded hover:bg-red-900 disabled:opacity-50"
                >
                  {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="border border-limestone bg-parchment/40 rounded-lg p-8 text-center text-sm text-muted">
              {records.length === 0 ? (
                <>
                  Tệp dữ liệu chính thức{' '}
                  <code className="font-mono">tulieu.json</code> hiện đang trống.
                </>
              ) : (
                'Không tìm thấy hồ sơ nào khớp từ khóa tìm kiếm.'
              )}
            </div>
          ) : (
            <div className="border border-limestone bg-ivory rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-parchment border-b border-limestone uppercase tracking-wider text-muted">
                    <th className="py-3 px-4">Mã hồ sơ</th>
                    <th className="py-3 px-4">Tên tư liệu</th>
                    <th className="py-3 px-4">Nơi lưu giữ</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Kiểm chứng</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-limestone">
                  {filteredRecords.map((r) => (
                    <tr key={r.identifier}>
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                        {r.identifier}
                      </td>
                      <td className="py-3 px-4 font-medium text-walnut-deep">
                        <div>{r.title}</div>
                        {r.ten_goi_khac && (
                          <div className="text-[11px] text-muted italic">
                            {r.ten_goi_khac}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted">
                        {r.noi_luu_giu_hien_nay}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ProcessingStatusBadge
                          status={r.trang_thai_xu_ly || 'DA_CONG_KHAI'}
                        />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <VerificationBadge status={r.muc_kiem_chung} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                        <button
                          type="button"
                          onClick={() => startEditing(r)}
                          className="font-semibold text-bronze hover:underline"
                        >
                          Quản lý
                        </button>
                        {currentUser.role === 'ADMIN' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="font-semibold text-red-700 hover:underline"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
