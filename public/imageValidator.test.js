// Feature: image-qa-app
import { describe, it, expect } from "vitest";
import { validate } from "./imageValidator.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5,242,880

/**
 * Creates a minimal synthetic File-like object for testing.
 * The real browser File API is not available in Node, so we use a plain object
 * that matches the shape validate() reads: { type, size }.
 */
function makeFile(type, size) {
  return { type, size };
}

// ---------------------------------------------------------------------------
// MIME type validation
// ---------------------------------------------------------------------------

describe("Image_Validator – MIME type", () => {
  it.each(ALLOWED_TYPES)("accepts %s", (mimeType) => {
    const result = validate(makeFile(mimeType, 1024));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects an unsupported MIME type", () => {
    const result = validate(makeFile("application/pdf", 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("error message for unsupported type lists accepted formats", () => {
    const result = validate(makeFile("image/bmp", 1024));
    expect(result.error).toMatch(/image\/jpeg/);
    expect(result.error).toMatch(/image\/png/);
    expect(result.error).toMatch(/image\/gif/);
    expect(result.error).toMatch(/image\/webp/);
  });

  it("rejects empty string MIME type", () => {
    const result = validate(makeFile("", 1024));
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Size validation
// ---------------------------------------------------------------------------

describe("Image_Validator – file size", () => {
  it("accepts a file exactly at the 5 MB limit", () => {
    const result = validate(makeFile("image/jpeg", MAX_BYTES));
    expect(result.valid).toBe(true);
  });

  it("rejects a file one byte over the 5 MB limit", () => {
    const result = validate(makeFile("image/jpeg", MAX_BYTES + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("error message for oversized file mentions 5 MB", () => {
    const result = validate(makeFile("image/png", MAX_BYTES + 1));
    expect(result.error).toMatch(/5 MB/);
  });

  it("accepts a 0-byte file with a valid MIME type", () => {
    const result = validate(makeFile("image/webp", 0));
    expect(result.valid).toBe(true);
  });

  it("rejects a very large file", () => {
    const result = validate(makeFile("image/gif", 100 * 1024 * 1024));
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MIME type check takes priority over size check
// ---------------------------------------------------------------------------

describe("Image_Validator – check ordering", () => {
  it("returns MIME error (not size error) when both checks fail", () => {
    const result = validate(makeFile("text/plain", MAX_BYTES + 1));
    expect(result.valid).toBe(false);
    // The error should mention accepted formats, not the size limit
    expect(result.error).toMatch(/image\/jpeg/);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

import * as fc from "fast-check";

// Feature: image-qa-app, Property 1: Client-side validation rejects oversized files
describe("Image_Validator – property tests", () => {
  it("Property 1: rejects any file whose size exceeds 5 MB", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5 * 1024 * 1024 + 1, max: 100 * 1024 * 1024 }),
        (size) => {
          const file = { type: "image/jpeg", size };
          return validate(file).valid === false;
        }
      )
    );
  });

  // Feature: image-qa-app, Property 2: Client-side validation rejects unsupported MIME types
  it("Property 2: rejects any unsupported MIME type", () => {
    fc.assert(
      fc.property(
        fc.string().filter(mime => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)),
        (generatedMime) => {
          const file = { type: generatedMime, size: 1024 };
          return validate(file).valid === false;
        }
      )
    );
  });
});
