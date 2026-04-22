// @vitest-environment jsdom

// Feature: image-qa-app-exercise
// Property test for UIController error state 
//
// Property 11: Error responses re-enable the submit button
// For any HTTP error status code (4xx or 5xx) returned by the backend,
// the frontend SHALL display a non-empty error message AND the submit button
// SHALL be re-enabled after the response is received.

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// DOM setup — runs once before all tests; UIController is imported after
// so it captures the correct element references.
// ---------------------------------------------------------------------------

beforeAll(() => {
  document.body.innerHTML = `
    <input type="file" id="image-input" />
    <div id="image-error"></div>
    <div id="image-preview-wrapper"></div>
    <img id="image-preview" />
    <textarea id="question-input"></textarea>
    <div id="question-error"></div>
    <div id="char-counter">0 / 1000</div>
    <button type="button" id="submit-btn">Ask</button>
    <div id="loading-indicator"></div>
    <div id="error-message"></div>
    <div id="result-area"></div>
    <div id="answer-text"></div>
    <div id="request-id-area"></div>
    <span id="request-id-value"></span>
  `;
});

// Import UIController after DOM is set up (module-level import is hoisted,
// but beforeAll runs before any test body, so the DOM is ready when the
// module's top-level getElementById calls execute on first use).
// We use a dynamic import inside the describe block to ensure ordering.

describe('UIController – Property 11: error responses re-enable submit', () => {
  let showLoading, hideLoading, showError, showAnswer;

  // Load UIController once the DOM is ready
  beforeAll(async () => {
    const mod = await import('./uiController.js');
    showLoading = mod.showLoading;
    hideLoading = mod.hideLoading;
    showError   = mod.showError;
    showAnswer  = mod.showAnswer;
  });

  // Helper: reset relevant DOM state between property iterations
  function resetState() {
    const submitBtn    = document.getElementById('submit-btn');
    const errorMessage = document.getElementById('error-message');
    const loadingIndicator = document.getElementById('loading-indicator');

    submitBtn.disabled = false;
    errorMessage.textContent = '';
    errorMessage.classList.remove('visible');
    loadingIndicator.classList.remove('visible');
  }

  // Feature: image-qa-app: Error responses re-enable the submit button
  // Validates: Requirements
  it('Property 11: showError() always produces a non-empty message and re-enables submit', () => {
    fc.assert(
      fc.property(
        // Generate HTTP error status codes 400–599
        fc.integer({ min: 400, max: 599 }),
        (statusCode) => {
          resetState();

          const submitBtn    = document.getElementById('submit-btn');
          const errorMessage = document.getElementById('error-message');

          // Simulate the loading state that precedes the error 
          showLoading();
          // Submit must be disabled while loading
          if (submitBtn.disabled !== true) return false;

          // Simulate receiving an HTTP error response
          const errorText = `Request failed with status ${statusCode}.`;
          showError(errorText);

          // Property assertions:
          // 1. Error message is visible and non-empty 
          const messageVisible  = errorMessage.classList.contains('visible');
          const messageNonEmpty = errorMessage.textContent.trim().length > 0;

          // 2. Submit button is re-enabled
          const submitReEnabled = submitBtn.disabled === false;

          return messageVisible && messageNonEmpty && submitReEnabled;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('showError() displays the exact error message text', () => {
    resetState();

    const errorMessage = document.getElementById('error-message');
    const submitBtn    = document.getElementById('submit-btn');

    const message = 'Request failed with status 502.';
    showError(message);

    expect(errorMessage.textContent).toBe(message);
    expect(errorMessage.classList.contains('visible')).toBe(true);
    expect(submitBtn.disabled).toBe(false);
  });

  it('showLoading() disables submit and hides previous error', () => {
    resetState();

    const submitBtn    = document.getElementById('submit-btn');
    const errorMessage = document.getElementById('error-message');

    // Pre-populate an error state
    errorMessage.classList.add('visible');
    errorMessage.textContent = 'Previous error';

    showLoading();

    expect(submitBtn.disabled).toBe(true);
    expect(errorMessage.classList.contains('visible')).toBe(false);
    expect(errorMessage.textContent).toBe('');
  });

  it('hideLoading() re-enables submit and hides spinner', () => {
    resetState();

    const submitBtn        = document.getElementById('submit-btn');
    const loadingIndicator = document.getElementById('loading-indicator');

    showLoading();
    expect(submitBtn.disabled).toBe(true);

    hideLoading();
    expect(submitBtn.disabled).toBe(false);
    expect(loadingIndicator.classList.contains('visible')).toBe(false);
  });

  it('showAnswer() renders answer text and clears previous answer', () => {
    resetState();

    const answerText  = document.getElementById('answer-text');
    const resultArea  = document.getElementById('result-area');

    // Set a previous answer
    answerText.textContent = 'Old answer';
    resultArea.classList.add('visible');

    showAnswer('New answer with\nline breaks', undefined, 'test-request-id');

    expect(answerText.textContent).toBe('New answer with\nline breaks');
    expect(resultArea.classList.contains('visible')).toBe(true);
  });
});
