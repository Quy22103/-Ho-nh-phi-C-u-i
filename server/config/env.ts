import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = process.cwd();

export const serverConfig = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  dataFilePath: path.resolve(
    ROOT_DIR,
    process.env.DATA_FILE_PATH || 'data/tulieu.json'
  ),
  submissionsFilePath: path.resolve(
    ROOT_DIR,
    process.env.SUBMISSIONS_FILE_PATH || 'data/submissions.json'
  ),
  usersFilePath: path.resolve(
    ROOT_DIR,
    process.env.USERS_FILE_PATH || 'data/users.json'
  ),
  auditLogFilePath: path.resolve(
    ROOT_DIR,
    process.env.AUDIT_LOG_FILE_PATH || 'data/audit_log.json'
  ),
  sessionSecretFilePath: path.resolve(ROOT_DIR, 'data/.session_secret'),
  sessionSecretEnv: (process.env.SESSION_SECRET || '').trim(),
  sessionTtlHours: Math.max(1, Number(process.env.SESSION_TTL_HOURS || 8)),
  imagesDir: path.resolve(ROOT_DIR, process.env.IMAGES_DIR || 'storage/images'),
  pendingImagesDir: path.resolve(
    ROOT_DIR,
    process.env.PENDING_IMAGES_DIR || 'storage/pending_images'
  ),
};

export function isGeminiConfigured(): boolean {
  return Boolean(
    serverConfig.geminiApiKey &&
      serverConfig.geminiApiKey !== 'MY_GEMINI_API_KEY'
  );
}
