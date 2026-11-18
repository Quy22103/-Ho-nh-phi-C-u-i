import { Router } from 'express';
import {
  exportCsv,
  exportJson,
  getRecordDetail,
  getRecordImage,
  getStats,
  getStatus,
  listRecords,
  listSources,
  postGeminiQA,
  postSubmission,
  postSuggestTranscription,
} from '../controllers/archiveController.ts';

export const apiRouter = Router();

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
apiRouter.post('/submissions', postSubmission);
