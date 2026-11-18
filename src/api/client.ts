import axios from 'axios';
import type {
  ArchiveSource,
  ArchiveStats,
  CitizenSubmissionInput,
  FilterQuery,
  PublicRecord,
  QAResponse,
  TranscriptionSuggestionResponse,
} from '../types/archive.ts';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
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
  input: CitizenSubmissionInput
): Promise<{
  ok: boolean;
  message: string;
  id: string;
  ngay_gui: string;
}> {
  const res = await api.post('/submissions', input);
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
