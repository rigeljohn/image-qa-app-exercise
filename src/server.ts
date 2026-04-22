import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { askHandler, upload } from './routes/ask.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require('multer') as { MulterError: new (code: string) => Error & { code: string } };

const app = express();

// CORS — allow requests from the Vercel frontend (set FRONTEND_URL in Railway env vars)
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
    exposedHeaders: ['X-Request-ID'],
  }),
);

// Serve static frontend files from public/ (used in local dev / single-process mode)
app.use(express.static(path.join(__dirname, '..', 'public')));

// /api/ask route — handles image + question, proxies to Gemini
app.post('/api/ask', upload.single('image'), askHandler);

// Multer error handler: catches LIMIT_FILE_SIZE and returns 413
// Must be defined after the route and have 4 parameters (err, req, res, next)
app.use(
  '/api/ask',
  (
    err: Error & { code?: string },
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Image exceeds the 5 MB limit' });
      return;
    }
    next(err);
  },
);

// Start listening only when this module is the entry point
if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { app };
