import axios from 'axios';
import type {
  ArchiveRecordRaw,
  ArchiveSource,
  ArchiveStats,
  AuditLogEntry,
  CitizenSubmissionInput,
  FilterQuery,
  ProcessingStatus,
  PublicRecord,
  QAResponse,
  SubmissionRecord,
  TranscriptionSuggestionResponse,
  UserAccountSafe,
} from '../types/archive.ts';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

export async function fetchSystemStatus(): Promise<{
  ok: boolean;
  geminiConfigured: boolean;
}> {
  const res = await api.get('/status');
  return res.data;
}

export async function fetchStats(): Promise<{
  metadata: {
    ten_du_an: string;
    phien_ban: string;
    ngay_tao: string;
    mo_ta: string;
  };
  stats: ArchiveStats;
}> {
  const res = await api.get('/stats');
  return res.data;
}

export async function fetchRecords(query: FilterQuery): Promise<{
  items: PublicRecord[];
  total: number;
  facets: {
    huyenLichSu: string[];
    xaHienNay: string[];
    xaLichSu: string[];
    thonLang: string[];
    repositories: string[];
  };
}> {
  const res = await api.get('/records', { params: query });
  return res.data;
}

export async function fetchRecordDetail(identifier: string): Promise<{
  record: PublicRecord;
  linkedSources: ArchiveSource[];
}> {
  const res = await api.get(`/records/${encodeURIComponent(identifier)}`);
  return res.data;
}

export async function fetchSources(): Promise<{
  sources: ArchiveSource[];
  recordLookup: Record<string, { identifier: string; title: string }>;
}> {
  const res = await api.get('/sources');
  return res.data;
}

export async function askGeminiArchive(question: string): Promise<QAResponse> {
  const res = await api.post('/gemini/qa', { question });
  return res.data;
}

export async function requestTranscriptionSuggestion(
  identifier: string,
  imageId: string
): Promise<TranscriptionSuggestionResponse> {
  const res = await api.post('/gemini/suggest-transcription', {
    identifier,
    imageId,
  });
  return res.data;
}

export async function submitCitizenContribution(
  input: CitizenSubmissionInput,
  files: File[]
): Promise<{
  ok: boolean;
  message: string;
  id: string;
  ngay_gui: string;
  trang_thai_xu_ly: ProcessingStatus;
}> {
  const formData = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  files.forEach((f) => formData.append('images', f));

  const res = await api.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function lookupSubmission(id: string): Promise<{
  submission_id: string;
  ten_tu_lieu: string;
  loai_tu_lieu: string;
  noi_luu_giu: string;
  ngay_gui: string;
  ngay_cap_nhat: string;
  trang_thai_xu_ly: ProcessingStatus;
  ly_do_xu_ly: string;
  official_identifier?: string;
}> {
  const res = await api.get(`/submissions/lookup/${encodeURIComponent(id)}`);
  return res.data;
}

export async function submitSupplement(
  id: string,
  thongTinBoSung: string,
  nguonBoSung: string,
  files: File[]
): Promise<{ ok: boolean; message: string; trang_thai_xu_ly: ProcessingStatus }> {
  const formData = new FormData();
  formData.append('thong_tin_bo_sung', thongTinBoSung);
  formData.append('nguon_bo_sung', nguonBoSung);
  files.forEach((f) => formData.append('images', f));
  const res = await api.post(
    `/submissions/${encodeURIComponent(id)}/supplement`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function downloadArchiveExport(
  format: 'json' | 'csv'
): Promise<string> {
  const res = await api.get(`/export/${format}`, {
    responseType: 'blob',
  });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let filename = `tu-lieu-hoanh-phi-cau-doi-ha-noi-${dateStr}.${format}`;

  const disposition = res.headers['content-disposition'];
  if (typeof disposition === 'string') {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) filename = match[1];
  }

  const blob = new Blob([res.data], {
    type:
      format === 'json'
        ? 'application/json;charset=utf-8'
        : 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

// Auth API
export async function fetchAuthSession(): Promise<{
  authenticated: boolean;
  needsInitialAdmin: boolean;
  user: UserAccountSafe | null;
}> {
  const res = await api.get('/auth/session');
  return res.data;
}

export async function bootstrapInitialAdmin(payload: {
  username: string;
  email: string;
  full_name: string;
  password: string;
}): Promise<{ ok: boolean; message: string; user: UserAccountSafe }> {
  const res = await api.post('/auth/bootstrap-admin', payload);
  return res.data;
}

export async function loginAdmin(
  identifier: string,
  password: string
): Promise<{ ok: boolean; user: UserAccountSafe }> {
  const res = await api.post('/auth/login', { identifier, password });
  return res.data;
}

export async function logoutAdmin(): Promise<void> {
  await api.post('/auth/logout');
}

// Protected Admin & Reviewer API
export async function fetchAdminOverview(): Promise<{
  statusCounts: Record<ProcessingStatus, number>;
  totalSubmissions: number;
  totalOfficialRecords: number;
  totalPublishedRecords: number;
  totalSources: number;
}> {
  const res = await api.get('/admin/overview');
  return res.data;
}

export async function fetchAdminSubmissions(
  status?: string
): Promise<{ submissions: SubmissionRecord[] }> {
  const res = await api.get('/admin/submissions', {
    params: status ? { status } : {},
  });
  return res.data;
}

export async function fetchAdminSubmissionDetail(
  id: string
): Promise<{ submission: SubmissionRecord }> {
  const res = await api.get(`/admin/submissions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function updateAdminSubmission(
  id: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; submission: SubmissionRecord }> {
  const res = await api.patch(
    `/admin/submissions/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}

export async function fetchAdminRecords(): Promise<{
  records: ArchiveRecordRaw[];
}> {
  const res = await api.get('/admin/records');
  return res.data;
}

export async function createAdminOfficialRecord(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; record: ArchiveRecordRaw }> {
  const res = await api.post('/admin/records', payload);
  return res.data;
}

export async function updateAdminOfficialRecord(
  identifier: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; record: ArchiveRecordRaw }> {
  const res = await api.patch(
    `/admin/records/${encodeURIComponent(identifier)}`,
    payload
  );
  return res.data;
}

export async function deleteAdminOfficialRecord(
  identifier: string
): Promise<{ ok: boolean; deletedIdentifier: string }> {
  const res = await api.delete(
    `/admin/records/${encodeURIComponent(identifier)}`
  );
  return res.data;
}

export async function uploadAdminRecordImages(
  identifier: string,
  files: File[],
  meta: {
    image_type: string;
    caption: string;
    source: string;
    permission: string;
  }
): Promise<{ ok: boolean; record: ArchiveRecordRaw }> {
  const formData = new FormData();
  formData.append('image_type', meta.image_type);
  formData.append('caption', meta.caption);
  formData.append('source', meta.source);
  formData.append('permission', meta.permission);
  files.forEach((f) => formData.append('images', f));
  const res = await api.post(
    `/admin/records/${encodeURIComponent(identifier)}/images`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function deleteAdminRecordImage(
  identifier: string,
  imageId: string
): Promise<{ ok: boolean; record: ArchiveRecordRaw }> {
  const res = await api.delete(
    `/admin/records/${encodeURIComponent(identifier)}/images/${encodeURIComponent(imageId)}`
  );
  return res.data;
}

export interface BulkImportPreviewResponse {
  format: 'json' | 'csv';
  totalRows: number;
  validRecords: ArchiveRecordRaw[];
  errors: Array<{ row: number; identifier: string; message: string }>;
  duplicateIdentifiers: string[];
}

export async function previewAdminBulkImport(
  format: 'json' | 'csv',
  content: string
): Promise<BulkImportPreviewResponse> {
  const res = await api.post('/admin/records/import/preview', {
    format,
    content,
  });
  return res.data;
}

export async function commitAdminBulkImport(
  format: 'json' | 'csv',
  content: string
): Promise<{
  ok: boolean;
  importedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; identifier: string; message: string }>;
}> {
  const res = await api.post('/admin/records/import/commit', {
    format,
    content,
  });
  return res.data;
}

export async function fetchAdminSources(): Promise<{
  sources: ArchiveSource[];
}> {
  const res = await api.get('/admin/sources');
  return res.data;
}

export async function upsertAdminSource(
  payload: Partial<ArchiveSource>
): Promise<{ ok: boolean; source: ArchiveSource }> {
  const res = await api.post('/admin/sources', payload);
  return res.data;
}

export async function fetchAdminUsers(): Promise<{
  users: UserAccountSafe[];
}> {
  const res = await api.get('/admin/users');
  return res.data;
}

export async function createAdminUser(payload: {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: 'ADMIN' | 'REVIEWER';
  can_publish: boolean;
}): Promise<{ ok: boolean; user: UserAccountSafe }> {
  const res = await api.post('/admin/users', payload);
  return res.data;
}

export async function updateAdminUser(
  userId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; user: UserAccountSafe }> {
  const res = await api.patch(
    `/admin/users/${encodeURIComponent(userId)}`,
    payload
  );
  return res.data;
}

export async function fetchAdminAuditLogs(params?: {
  ma_ho_so?: string;
  tai_khoan?: string;
  hanh_dong?: string;
}): Promise<{ logs: AuditLogEntry[] }> {
  const res = await api.get('/admin/audit-logs', { params });
  return res.data;
}
