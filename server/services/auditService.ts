import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { serverConfig } from '../config/env.ts';
import type { AuditLogEntry } from '../../src/types/archive.ts';

async function readAllLogs(): Promise<AuditLogEntry[]> {
  try {
    const raw = await fs.readFile(serverConfig.auditLogFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { logs?: AuditLogEntry[] };
    return Array.isArray(parsed.logs) ? parsed.logs : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function appendAuditLog(params: {
  ma_ho_so: string;
  tai_khoan: string;
  vai_tro: string;
  hanh_dong: string;
  noi_dung_truoc?: unknown;
  noi_dung_sau?: unknown;
  ly_do?: string;
}): Promise<AuditLogEntry> {
  const logs = await readAllLogs();
  const entry: AuditLogEntry = {
    log_id: `LOG-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    ma_ho_so: params.ma_ho_so,
    tai_khoan: params.tai_khoan,
    vai_tro: params.vai_tro,
    thoi_gian: new Date().toISOString(),
    hanh_dong: params.hanh_dong,
    noi_dung_truoc:
      typeof params.noi_dung_truoc === 'string'
        ? params.noi_dung_truoc
        : JSON.stringify(params.noi_dung_truoc ?? {}),
    noi_dung_sau:
      typeof params.noi_dung_sau === 'string'
        ? params.noi_dung_sau
        : JSON.stringify(params.noi_dung_sau ?? {}),
    ly_do: (params.ly_do || '').trim(),
  };

  logs.unshift(entry);
  await fs.mkdir(path.dirname(serverConfig.auditLogFilePath), {
    recursive: true,
  });
  await fs.writeFile(
    serverConfig.auditLogFilePath,
    JSON.stringify({ logs }, null, 2),
    'utf8'
  );
  return entry;
}

export async function listAuditLogs(filters?: {
  ma_ho_so?: string;
  tai_khoan?: string;
  hanh_dong?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let logs = await readAllLogs();
  if (filters?.ma_ho_so) {
    const target = filters.ma_ho_so.toLowerCase();
    logs = logs.filter((l) => l.ma_ho_so.toLowerCase().includes(target));
  }
  if (filters?.tai_khoan) {
    const target = filters.tai_khoan.toLowerCase();
    logs = logs.filter((l) => l.tai_khoan.toLowerCase().includes(target));
  }
  if (filters?.hanh_dong) {
    logs = logs.filter((l) => l.hanh_dong === filters.hanh_dong);
  }
  const limit = Math.min(500, Math.max(1, filters?.limit || 200));
  return logs.slice(0, limit);
}
