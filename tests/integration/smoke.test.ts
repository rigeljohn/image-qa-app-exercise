/**
 * Smoke tests: verify the app starts and serves the frontend correctly.
 *
 * Covers:
 *  - GET / returns 200 with HTML content
 *  - .env is listed in .gitignore
 *
 * Requirements: 7.1, 6.4
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Import the app (does NOT call app.listen() — supertest handles binding)
import { app } from '../../src/server.js';

// ---------------------------------------------------------------------------
// Smoke test: frontend is served
// ---------------------------------------------------------------------------

describe('Smoke test: app starts and serves frontend', () => {
  it('GET / returns 200 with HTML content', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    // Express static middleware sets Content-Type to text/html for index.html
    expect(response.headers['content-type']).toMatch(/text\/html/);
    // The response body should contain HTML markup
    expect(response.text).toContain('<html');
  });

  it('GET / response body contains a <form> or <input> element (frontend is loaded)', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    // The index.html should have a file input or form for image upload
    expect(response.text.toLowerCase()).toMatch(/<input|<form/);
  });
});

// ---------------------------------------------------------------------------
// Security check: .env is excluded from version control
// ---------------------------------------------------------------------------

describe('Security: .env is listed in .gitignore', () => {
  it('.gitignore exists at the project root', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
  });

  it('.env is listed in .gitignore', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf-8');

    // The .gitignore should contain an entry that matches ".env"
    // It may be listed as ".env", ".env.*", or similar patterns
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    const coversEnv = lines.some((line) => {
      // Exact match for ".env"
      if (line === '.env') return true;
      // Glob patterns like ".env*" or ".env.*" also cover ".env"
      if (line === '.env*' || line === '.env.*') return true;
      return false;
    });

    expect(coversEnv).toBe(true);
  });
});
