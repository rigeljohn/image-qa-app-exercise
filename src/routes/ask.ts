/**
 * /api/ask route handler
 *
 * Validates the incoming multipart request, calls Gemini_Client.ask(),
 * and returns a structured JSON response.
 */

import { RequestHandler, Request } from 'express';
import { randomUUID } from 'crypto';

// Multer attaches the uploaded file to req.file; we extend the Request type
// locally rather than augmenting the global namespace.
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require('multer') as {
  (options: {
    storage: ReturnType<typeof multer.memoryStorage>;
    limits?: { fileSize?: number };
  }): { single(fieldName: string): RequestHandler };
  memoryStorage(): object;
};
import { ask as Gemini_Client_ask } from '../geminiClient.js';
import { log } from '../requestLogger.js';

// ---------------------------------------------------------------------------
// Multer upload middleware (5 MB limit enforced at the transport layer)
// ---------------------------------------------------------------------------

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const askHandler: RequestHandler = async (req, res): Promise<void> => {
  // 1. Resolve or generate a Request ID
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ??
    randomUUID();

  // Always attach the Request ID to the response, even on error paths
  res.setHeader('X-Request-ID', requestId);

  // 2. Validate image presence and size
  //    Multer enforces the 5 MB limit at the transport layer and emits a
  //    MulterError with code LIMIT_FILE_SIZE. However, if the file somehow
  //    slips through (e.g. in tests that bypass multer), we double-check here.
  const file = (req as Request & { file?: MulterFile }).file;
  const MAX_BYTES = 5 * 1024 * 1024;

  if (file && file.buffer.length > MAX_BYTES) {
    log('warn', 'Image exceeds size limit', { requestId, size: file.buffer.length });
    res.status(413).json({ error: 'Image exceeds the 5 MB limit' });
    return;
  }

  // 3. Validate question presence and non-empty
  const question =
    typeof req.body?.question === 'string' ? req.body.question : '';

  if (!question.trim()) {
    log('warn', 'Missing or blank question', { requestId });
    res.status(400).json({ error: 'question is required' });
    return;
  }

  // 4. Call Gemini_Client.ask()
  const imageBuffer: Buffer = file?.buffer ?? Buffer.alloc(0);
  const mimeType: string = file?.mimetype ?? 'application/octet-stream';
  const agenticMode =
    req.body?.agenticMode === 'true' || req.body?.agenticMode === true;

  try {
    const result = await Gemini_Client_ask({
      imageBuffer,
      mimeType,
      question,
      agenticMode,
    });

    // 5. Return 200 with answer, requestId, and optional steps
    log('info', 'Request completed successfully', {
      requestId,
      statusCode: 200,
    });

    const responseBody: {
      answer: string;
      requestId: string;
      steps?: typeof result.steps;
    } = {
      answer: result.answer,
      requestId,
    };

    if (result.steps !== undefined) {
      responseBody.steps = result.steps;
    }

    res.status(200).json(responseBody);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // 6. Map errors to appropriate HTTP status codes
    if (message.includes('did not respond in time') || message.includes('timed out')) {
      log('warn', 'Gemini timeout', { requestId, error: message });
      res.status(504).json({
        error: 'The AI model did not respond in time. Please try again.',
      });
      return;
    }

    // Treat any error thrown by Gemini_Client as a 502 — the client already
    // sanitises the message (strips API key) before re-throwing, so it is
    // safe to forward. This covers quota errors, 503 UNAVAILABLE, auth
    // failures, and any other SDK-level error.
    log('error', 'Gemini API error', { requestId, error: message });
    res.status(502).json({ error: message });
  }
};
