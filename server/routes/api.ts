import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { serverConfig } from '../config/env.ts';
import {
  exportCsv,
  exportJson,
  getRecordDetail,
  getRecordImage,
  getStats,
  getStatus,
  listRecords,
  listSources,
  lookupSubmissionStatus,
  postGeminiQA,
  postSubmission,
  postSuggestTranscription,
  postSupplementToSubmission,
} from '../controllers/archiveController.ts';
import {
  getAuthSession,
  postBootstrapAdmin,
  postLogin,
  postLogout,
} from '../controllers/authController.ts';
import {
  commitBulkImportAdmin,
  createOfficialRecordAdmin,
  createUserAdmin,
  deleteOfficialRecordAdmin,
  deleteOfficialRecordImageAdmin,
  getAdminOverview,
  getAdminSubmissionDetail,
  getAuditLogsAdmin,
  getPendingImageFile,
  listAdminSources,
  listAdminSubmissions,
  listOfficialRecordsAdmin,
  listUsersAdmin,
  previewBulkImportAdmin,
  updateAdminSubmission,
  updateOfficialRecordAdmin,
  updateUserAdmin,
  uploadOfficialRecordImagesAdmin,
  upsertAdminSource,
} from '../controllers/adminController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';

fs.mkdirSync(serverConfig.pendingImagesDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, serverConfig.pendingImagesDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
        ? ext
        : '.jpg';
      cb(
        null,
        `pending-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`
      );
    },
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp ảnh định dạng JPG, PNG hoặc WEBP.'));
    }
  },
});

export const apiRouter = Router();

// Public routes
apiRouter.get('/status', getStatus);
apiRouter.get('/stats', getStats);
apiRouter.get('/records', listRecords);
apiRouter.get('/records/:identifier', getRecordDetail);
apiRouter.get('/images/:identifier/:imageId', getRecordImage);
apiRouter.get('/sources', listSources);
apiRouter.post('/gemini/qa', postGeminiQA);
apiRouter.post('/gemini/suggest-transcription', postSuggestTranscription);
apiRouter.get('/export/json', exportJson);
apiRouter.get('/export/csv', exportCsv);

// Citizen contribution & tracking lookup (PUBLIC)
apiRouter.post('/submissions', upload.array('images', 5), postSubmission);
apiRouter.get('/submissions/lookup/:id', lookupSubmissionStatus);
apiRouter.post(
  '/submissions/:id/supplement',
  upload.array('images', 5),
  postSupplementToSubmission
);

// Auth routes
apiRouter.get('/auth/session', getAuthSession);
apiRouter.post('/auth/bootstrap-admin', postBootstrapAdmin);
apiRouter.post('/auth/login', postLogin);
apiRouter.post('/auth/logout', postLogout);

// Protected REVIEWER & ADMIN routes
apiRouter.get(
  '/admin/overview',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  getAdminOverview
);
apiRouter.get(
  '/admin/submissions',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  listAdminSubmissions
);
apiRouter.get(
  '/admin/submissions/:id',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  getAdminSubmissionDetail
);
apiRouter.get(
  '/admin/submissions/:id/images/:imageId',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  getPendingImageFile
);
apiRouter.patch(
  '/admin/submissions/:id',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  updateAdminSubmission
);
apiRouter.get(
  '/admin/records',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  listOfficialRecordsAdmin
);
apiRouter.post(
  '/admin/records',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  createOfficialRecordAdmin
);
apiRouter.post(
  '/admin/records/import/preview',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  previewBulkImportAdmin
);
apiRouter.post(
  '/admin/records/import/commit',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  commitBulkImportAdmin
);
apiRouter.patch(
  '/admin/records/:identifier',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  updateOfficialRecordAdmin
);
apiRouter.delete(
  '/admin/records/:identifier',
  requireAuth,
  requireRole(['ADMIN']),
  deleteOfficialRecordAdmin
);
apiRouter.post(
  '/admin/records/:identifier/images',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  upload.array('images', 10),
  uploadOfficialRecordImagesAdmin
);
apiRouter.delete(
  '/admin/records/:identifier/images/:imageId',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  deleteOfficialRecordImageAdmin
);
apiRouter.get(
  '/admin/sources',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  listAdminSources
);
apiRouter.post(
  '/admin/sources',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  upsertAdminSource
);
apiRouter.get(
  '/admin/audit-logs',
  requireAuth,
  requireRole(['ADMIN', 'REVIEWER']),
  getAuditLogsAdmin
);

// Strictly ADMIN-only account management routes
apiRouter.get(
  '/admin/users',
  requireAuth,
  requireRole(['ADMIN']),
  listUsersAdmin
);
apiRouter.post(
  '/admin/users',
  requireAuth,
  requireRole(['ADMIN']),
  createUserAdmin
);
apiRouter.patch(
  '/admin/users/:userId',
  requireAuth,
  requireRole(['ADMIN']),
  updateUserAdmin
);
