// Feature: image-qa-app
// Unit and property tests for QuestionValidator

import { describe, it, expect } from "vitest";
import { validate } from "./questionValidator.js";
import * as fc from "fast-check";

const MAX_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Blank / whitespace-only input
// ---------------------------------------------------------------------------

describe("QuestionValidator – blank input", () => {
  it("rejects an empty string", () => {
    const result = validate("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a string of only spaces", () => {
    const result = validate("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a string of only tabs", () => {
    const result = validate("\t\t\t");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a string of only newlines", () => {
    const result = validate("\n\n\n");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a mixed whitespace-only string", () => {
    const result = validate(" \t\n\r ");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Length validation
// ---------------------------------------------------------------------------

describe("QuestionValidator – length", () => {
  it("accepts a question of exactly 1000 characters", () => {
    const result = validate("a".repeat(MAX_LENGTH));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects a question of 1001 characters", () => {
    const result = validate("a".repeat(MAX_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("error message for oversized question mentions 1000 characters", () => {
    const result = validate("a".repeat(MAX_LENGTH + 1));
    expect(result.error).toMatch(/1000/);
  });

  it("accepts a short valid question", () => {
    const result = validate("What is in this image?");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts a single non-whitespace character", () => {
    const result = validate("?");
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------

describe("QuestionValidator – valid input", () => {
  it("accepts a question with leading/trailing whitespace (non-empty after trim)", () => {
    const result = validate("  What is this?  ");
    expect(result.valid).toBe(true);
  });

  it("accepts a multi-line question", () => {
    const result = validate("Line one\nLine two");
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: image-qa-app, Property 3: Question validation rejects blank or whitespace-only input
describe("QuestionValidator – property tests", () => {
  it("Property 3: rejects any blank or whitespace-only string", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(" ", "\t", "\n", "\r")).map((chars) => chars.join("")),
        (whitespaceStr) => {
          return validate(whitespaceStr).valid === false;
        }
      )
    );
  });

  // Feature: image-qa-app, Property 4: Question validation enforces length bounds
  it("Property 4a: rejects any string longer than 1000 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_LENGTH + 1 }),
        (longStr) => {
          return validate(longStr).valid === false;
        }
      )
    );
  });

  it("Property 4b: accepts any non-empty string of 1–1000 chars with at least one non-whitespace character", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: MAX_LENGTH })
          .filter((s) => s.trim().length > 0),
        (validStr) => {
          return validate(validStr).valid === true;
        }
      )
    );
  });
});
