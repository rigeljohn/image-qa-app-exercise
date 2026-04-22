// Feature: image-qa-app
// UIController — manages DOM state transitions: idle → loading → result/error
// Requirements: 2.2, 2.3, 2.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 11.2, 11.3

// DOM elements are looked up lazily inside each function so that tests can
// reset the DOM between runs and re-import this module without stale references.

function el(id) {
  return document.getElementById(id);
}

/**
 * Display the loading indicator and disable the submit button.
 */
export function showLoading() {
  el('loading-indicator').classList.add('visible');
  el('submit-btn').disabled = true;

  // Hide any previous error or result while loading
  el('error-message').classList.remove('visible');
  el('error-message').textContent = '';
}

/**
 * Hide the loading indicator and re-enable the submit button.
 */
export function hideLoading() {
  el('loading-indicator').classList.remove('visible');
  el('submit-btn').disabled = false;
}

/**
 * Render the answer text in the result area.
 *
 * @param {string} answer - The answer text from the API.
 * @param {Array<{type: string, content?: string, language?: string, code?: string, output?: string, image?: string}>} [steps] - Optional agentic steps.
 * @param {string} [requestId] - Optional request ID to display.
 */
export function showAnswer(answer, _steps, requestId) {
  // Clear previous answer (Req 4.2)
  el('answer-text').textContent = '';
  el('result-area').classList.remove('visible');
  el('request-id-area').classList.remove('visible');

  el('answer-text').textContent = answer;
  el('result-area').classList.add('visible');

  if (requestId) {
    el('request-id-value').textContent = requestId;
    el('request-id-area').classList.add('visible');
  }
}

/**
 * Display a human-readable error message and re-enable the submit button.
 * error message shown on 4xx/5xx; submit re-enabled.
 * error message shown on network failure; submit re-enabled.
 *
 * @param {string} message - The error message to display.
 */
export function showError(message) {
  el('error-message').textContent = message;
  el('error-message').classList.add('visible');

  // Re-enable submit so the user can try again
  el('submit-btn').disabled = false;
}

/**
 * Populate the question input with a preset template text.
 *
 * @param {string} text - The preset question text.
 */
export function setPreset(text) {
  el('question-input').value = text;
  // Dispatch an input event so any listeners (char counter) update
  el('question-input').dispatchEvent(new Event('input', { bubbles: true }));
  el('question-input').focus();
}
