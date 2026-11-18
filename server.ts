import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { serverConfig } from './server/config/env.ts';
import { apiRouter } from './server/routes/api.ts';
import { bootstrapAdminFromEnvIfConfigured } from './server/services/authService.ts';

async function startServer() {
  await bootstrapAdminFromEnvIfConfigured();

  const app = express();

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  if (serverConfig.nodeEnv === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Ứng dụng chưa được biên dịch (npm run build).');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(
      `Hồ sơ số Hoành phi – Câu đối Hà Nội đang chạy tại http://localhost:${serverConfig.port}`
    );
  });
}

startServer().catch((err) => {
  console.error('Lỗi khởi động máy chủ:', err);
  process.exit(1);
});
