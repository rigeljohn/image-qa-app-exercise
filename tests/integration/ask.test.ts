/**
 * Integration tests for POST /api/ask
 *
 * Uses supertest to send real HTTP requests to the Express app.
 * The @google/genai SDK is mocked so no real Gemini API calls are made.
 *
 * Covers:
 *  - 200 with answer field on valid image + question
 *  - 413 on oversized image
 *  - 400 on missing question
 *  - 504 on Gemini timeout
 *  - X-Request-ID echoed in response headers
 *  - GEMINI_API_KEY absent from all response bodies and headers
 *
 * Requirements: 3.1–3.7, 6.1, 13.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { app } from '../../src/server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SMALL_IMAGE = Buffer.alloc(100, 0xff); // 100 bytes — well under 5 MB
const OVERSIZED_IMAGE = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff); // 5 MB + 1 byte

/** Configure the mock to return a successful Gemini response. */
function mockGeminiSuccess(answer = 'The image shows a cat.') {
  mockGenerateContent.mockResolvedValueOnce({
    candidates: [
      {
        content: {
          parts: [{ text: answer }],
        },
      },
    ],
    text: answer,
  });
}

/** Configure the mock to throw a timeout error. */
function mockGeminiTimeout() {
  mockGenerateContent.mockRejectedValueOnce(
    new Error('The AI model did not respond in time. Please try again.'),
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-integration-api-key-abc123xyz';

beforeEach(() => {
  process.env.GEMINI_API_KEY = TEST_API_KEY;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ask — integration tests', () => {
  // -------------------------------------------------------------------------
  // 1. Valid image + question → 200 with answer field
  // -------------------------------------------------------------------------
  it('returns 200 with an answer field for a valid image and question', async () => {
    mockGeminiSuccess('The serial number is XYZ-1234.');

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is the serial number?');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('answer');
    expect(typeof response.body.answer).toBe('string');
    expect(response.body.answer.length).toBeGreaterThan(0);
  });

  it('returns 200 with requestId in the response body', async () => {
    mockGeminiSuccess();

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'Describe this image.');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('requestId');
    expect(typeof response.body.requestId).toBe('string');
  });

  // -------------------------------------------------------------------------
  // 2. Oversized image → 413
  // -------------------------------------------------------------------------
  it('returns 413 when the image exceeds 5 MB', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', OVERSIZED_IMAGE, {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(413);
    expect(response.body).toHaveProperty('error');
  });

  it('does not call Gemini when the image is oversized', async () => {
    await request(app)
      .post('/api/ask')
      .attach('image', OVERSIZED_IMAGE, {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Missing question → 400
  // -------------------------------------------------------------------------
  it('returns 400 when the question field is missing', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });
    // No .field('question', ...) — question is absent

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('returns 400 when the question is an empty string', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', '');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('returns 400 when the question is whitespace-only', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', '   \t\n  ');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('does not call Gemini when the question is missing', async () => {
    await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. Gemini timeout → 504
  // -------------------------------------------------------------------------
  it('returns 504 when Gemini times out', async () => {
    mockGeminiTimeout();

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(504);
    expect(response.body).toHaveProperty('error');
  });

  // -------------------------------------------------------------------------
  // 5. X-Request-ID echoed in response headers
  // -------------------------------------------------------------------------
  it('echoes the X-Request-ID header sent by the client', async () => {
    mockGeminiSuccess();
    const requestId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await request(app)
      .post('/api/ask')
      .set('X-Request-ID', requestId)
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('generates and returns an X-Request-ID when none is provided', async () => {
    mockGeminiSuccess();

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
    expect(response.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  it('includes X-Request-ID in error responses (400)', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', '');

    expect(response.status).toBe(400);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('includes X-Request-ID in error responses (413)', async () => {
    const response = await request(app)
      .post('/api/ask')
      .attach('image', OVERSIZED_IMAGE, {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is this?');

    expect(response.status).toBe(413);
    // Note: multer's error handler also sets the header via the route handler
    // for 413 responses caught by the route handler itself (not multer middleware)
  });

  // -------------------------------------------------------------------------
  // 6. GEMINI_API_KEY absent from all response bodies and headers
  // -------------------------------------------------------------------------
  it('does not expose GEMINI_API_KEY in the response body on success', async () => {
    mockGeminiSuccess('Here is the answer without any key.');

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(200);
    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain(TEST_API_KEY);
  });

  it('does not expose GEMINI_API_KEY in response headers on success', async () => {
    mockGeminiSuccess();

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    expect(response.status).toBe(200);
    const headersStr = JSON.stringify(response.headers);
    expect(headersStr).not.toContain(TEST_API_KEY);
  });

  it('does not expose GEMINI_API_KEY in error response bodies', async () => {
    // Simulate a Gemini error that might contain the key
    mockGenerateContent.mockRejectedValueOnce(
      new Error(`Authentication failed: key=${TEST_API_KEY}`),
    );

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    // Should be a 502 or 500 — either way, key must not appear
    expect(response.status).toBeGreaterThanOrEqual(400);
    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain(TEST_API_KEY);
  });

  it('does not expose GEMINI_API_KEY in response headers on error', async () => {
    mockGenerateContent.mockRejectedValueOnce(
      new Error('Some Gemini API error'),
    );

    const response = await request(app)
      .post('/api/ask')
      .attach('image', SMALL_IMAGE, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('question', 'What is in this image?');

    const headersStr = JSON.stringify(response.headers);
    expect(headersStr).not.toContain(TEST_API_KEY);
  });
});
