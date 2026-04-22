import express from 'express';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require('multer') as {
  (options: {
    storage: ReturnType<typeof multer.memoryStorage>;
    limits?: { fileSize?: number };
  }): { single(fieldName: string): express.RequestHandler };
  memoryStorage(): object;
};

const app = express();

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure multer with memory storage and 5 MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Placeholder /api/ask route — actual handler implemented in task 8
app.post('/api/ask', upload.single('image'), (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' });
});

// Start listening only when this module is the entry point
if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { app };
