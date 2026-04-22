// Feature: image-qa-app, Property 5: Backend rejects oversized images before calling Gemini
// Feature: image-qa-app, Property 6: Backend rejects blank or whitespace-only questions
// Feature: image-qa-app, Property 8: Request ID round-trip

/**
 * Property-based tests for the /api/ask route handler.
 *
 * Validates: Requirements 3.5, 3.6, 13.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock @google/genai before importing the app
// ---------------------------------------------------------------------------

const { mockGenerateContent } = vi.hoisted(() => {
  return { mockGenerateContent: vi.fn() };
});

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = { generateContent: mockGenerateContent };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  }
  return { GoogleGenAI };
});

// Import the app AFTER mocking so the mock is in place
import { app } from '../server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid Gemini response */
function mockGeminiSuccess() {
  mockGenerateContent.mockResolvedValue({
    candidates: [{ content: { parts: [{ text: 'mocked answer' }] } }],
    text: 'mocked answer',
  });
}

// ---------------------------------------------------------------------------
// Property 5: Backend rejects oversized images before calling Gemini
// ---------------------------------------------------------------------------

describe('Property 5: Backend rejects oversized images before calling Gemini', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 413 for any image buffer exceeding 5 MB and does not call Gemini', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }),
        async (size) => {
          vi.clearAllMocks();
          const oversizedBuffer = Buffer.alloc(size);

          const response = await request(app)
            .post('/api/ask')
            .attach('image', oversizedBuffer, {
              filename: 'test.jpg',
              contentType: 'image/jpeg',
            })
            .field('question', 'What is this?');

          expect(response.status).toBe(413);
          expect(mockGenerateContent).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Backend rejects blank or whitespace-only questions
// ---------------------------------------------------------------------------

describe('Property 6: Backend rejects blank or whitespace-only questions', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 400 for any whitespace-only question and does not call Gemini', async () => {
    // Small valid image buffer
    const smallImage = Buffer.alloc(100);

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r')).map((chars) => chars.join('')),
        async (blankQuestion) => {
          vi.clearAllMocks();

          const response = await request(app)
            .post('/api/ask')
            .attach('image', smallImage, {
              filename: 'test.jpg',
              contentType: 'image/jpeg',
            })
            .field('question', blankQuestion);

          expect(response.status).toBe(400);
          expect(mockGenerateContent).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Request ID round-trip
// ---------------------------------------------------------------------------

describe('Property 8: Request ID round-trip', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('echoes the X-Request-ID header sent by the client', async () => {
    const smallImage = Buffer.alloc(100);

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (requestId) => {
          vi.clearAllMocks();
          mockGeminiSuccess();

          const response = await request(app)
            .post('/api/ask')
            .set('X-Request-ID', requestId)
            .attach('image', smallImage, {
              filename: 'test.jpg',
              contentType: 'image/jpeg',
            })
            .field('question', 'What is this?');

          // The response header name is case-insensitive in HTTP
          const returnedId =
            response.headers['x-request-id'] as string | undefined;

          expect(returnedId).toBe(requestId);
        },
      ),
      { numRuns: 50 },
    );
  });
});
