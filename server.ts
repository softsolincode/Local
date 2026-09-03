import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { getMainDb } from './server/sqlite-manager';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing & cookies
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());

  // Initialize main database
  try {
    await getMainDb();
    console.log('[Database] Main SQLite database initialized successfully');
  } catch (err) {
    console.error('[Database] Error initializing main SQLite database:', err);
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'SQLite3 (sql.js / Zero-Driver Wasm)',
      database: 'main.sqlite + per-user databases',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Vite middleware in development / static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockTrack Server running on http://localhost:${PORT}`);
  });
}

startServer();
