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
  imagesDir: path.resolve(ROOT_DIR, process.env.IMAGES_DIR || 'storage/images'),
};

export function isGeminiConfigured(): boolean {
  return Boolean(
    serverConfig.geminiApiKey &&
      serverConfig.geminiApiKey !== 'MY_GEMINI_API_KEY'
  );
}
