// Feature: image-qa-app
// UIController — manages DOM state transitions: idle → loading → result/error
// Requirements: 2.2, 2.3, 2.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 11.2, 11.3

const submitBtn       = document.getElementById('submit-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage    = document.getElementById('error-message');
const resultArea      = document.getElementById('result-area');
const answerText      = document.getElementById('answer-text');
const requestIdArea   = document.getElementById('request-id-area');
const requestIdValue  = document.getElementById('request-id-value');
const questionInput   = document.getElementById('question-input');

/**
 * Display the loading indicator and disable the submit button.
 */
export function showLoading() {
  loadingIndicator.classList.add('visible');
  submitBtn.disabled = true;

  // Hide any previous error or result while loading
  errorMessage.classList.remove('visible');
  errorMessage.textContent = '';
}

/**
 * Hide the loading indicator and re-enable the submit button.
 */
export function hideLoading() {
  loadingIndicator.classList.remove('visible');
  submitBtn.disabled = false;
}

/**
 * Render the answer text in the result area.
 * Clears any previous answer first
 * Preserves whitespace and line breaks via CSS white-space.
 *
 * @param {string} answer - The answer text from the API.
 * @param {Array<{type: string, content?: string, language?: string, code?: string, output?: string, image?: string}>} [steps] - Optional agentic steps.
 * @param {string} [requestId] - Optional request ID to display.
 */
export function showAnswer(answer, steps, requestId) {
  // Clear previous answer (Req 4.2)
  answerText.textContent = '';
  resultArea.classList.remove('visible');
  requestIdArea.classList.remove('visible');

  // Set answer text — white-space: pre-wrap in CSS handles
  answerText.textContent = answer;
  resultArea.classList.add('visible');

  // Display request ID if provided 
  if (requestId) {
    requestIdValue.textContent = requestId;
    requestIdArea.classList.add('visible');
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
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');

  // Re-enable submit so the user can try again
  submitBtn.disabled = false;
}

/**
 * Populate the question input with a preset template text.
 * clicking a preset populates the question field.
 * user can still edit the populated text.
 *
 * @param {string} text - The preset question text.
 */
export function setPreset(text) {
  questionInput.value = text;
  // Dispatch an input event so any listeners (char counter, ghost suggestion) update
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  questionInput.focus();
}
