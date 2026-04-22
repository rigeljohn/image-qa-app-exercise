// Feature: image-qa-app
// app.js — main entry point; wires up all frontend modules

import { validate as validateImage } from './imageValidator.js';
import { validate as validateQuestion } from './questionValidator.js';
import * as UIController from './uiController.js';
import { ask } from './apiClient.js';

// ── DOM references ──────────────────────────────────────────────────────────
const imageInput        = document.getElementById('image-input');
const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
const imagePreview      = document.getElementById('image-preview');
const imageError        = document.getElementById('image-error');
const questionInput     = document.getElementById('question-input');
const questionError     = document.getElementById('question-error');
const charCounter       = document.getElementById('char-counter');
const submitBtn         = document.getElementById('submit-btn');
const presetButtons     = document.querySelectorAll('[data-preset]');

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_QUESTION_LENGTH = 1000;

// ── State ───────────────────────────────────────────────────────────────────
let selectedFile = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 string.
 * Uses the Web Crypto API (available in all modern browsers).
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Show an inline validation error near the image input. */
function showImageError(message) {
  imageError.textContent = message;
  imageError.classList.add('visible');
}

/** Clear the inline image validation error. */
function clearImageError() {
  imageError.textContent = '';
  imageError.classList.remove('visible');
}

/** Show an inline validation error near the question input. */
function showQuestionError(message) {
  questionError.textContent = message;
  questionError.classList.add('visible');
}

/** Clear the inline question validation error. */
function clearQuestionError() {
  questionError.textContent = '';
  questionError.classList.remove('visible');
}

// ── Event: file input change ─────────────────────────────────────────────────
// show preview on valid file; allow replacement
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];

  // Reset previous state
  clearImageError();
  imagePreviewWrapper.classList.remove('visible');
  imagePreview.src = '';
  selectedFile = null;

  if (!file) return;

  // Req 1.2, 1.3: validate before any network request
  const result = validateImage(file);
  if (!result.valid) {
    showImageError(result.error);
    return;
  }

  // Valid file — show preview 
  selectedFile = file;
  const objectUrl = URL.createObjectURL(file);
  imagePreview.src = objectUrl;
  imagePreview.onload = () => URL.revokeObjectURL(objectUrl); // free memory after load
  imagePreviewWrapper.classList.add('visible');
});

// ── Event: question input ────────────────────────────────────────────────────
//character counter + warning when over limit
questionInput.addEventListener('input', () => {
  const len = questionInput.value.length;
  charCounter.textContent = `${len} / ${MAX_QUESTION_LENGTH}`;

  if (len > MAX_QUESTION_LENGTH) {
    charCounter.classList.add('over-limit');
  } else {
    charCounter.classList.remove('over-limit');
  }

  // Clear inline question error as user types
  clearQuestionError();
});

// ── Event: preset buttons ────────────────────────────────────────────────────
presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    UIController.setPreset(btn.dataset.preset);
    clearQuestionError();
  });
});

// ── Event: submit ────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  // Clear previous errors
  clearImageError();
  clearQuestionError();

  // Validate image 
  if (!selectedFile) {
    showImageError('Please select an image before submitting.');
    return;
  }

  const imageValidation = validateImage(selectedFile);
  if (!imageValidation.valid) {
    showImageError(imageValidation.error);
    return;
  }

  // Validate question 
  const questionValidation = validateQuestion(questionInput.value);
  if (!questionValidation.valid) {
    showQuestionError(questionValidation.error);
    return;
  }

  // Generate Request ID 
  const requestId = generateUUID();

  // Show loading state 
  UIController.showLoading();

  try {
    const data = await ask(selectedFile, questionInput.value, requestId);

    // Hide loading 
    UIController.hideLoading();

    // Render answer 
    UIController.showAnswer(data.answer, data.steps, data.requestId || requestId);
  } catch (err) {
    // Hide loading (Req 5.4)
    UIController.hideLoading();

    // Show error 
    UIController.showError(err.message || 'An unexpected error occurred. Please try again.');
  }
});
