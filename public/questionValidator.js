// Feature: image-qa-app
// QuestionValidator — client-side question input validation

const MAX_QUESTION_LENGTH = 1000;

/**
 * Validates a question string before submission.
 *
 * @param {string} question - The question entered by the user.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validate(question) {
  if (question.trim().length === 0) {
    return {
      valid: false,
      error: "Please enter a question before submitting.",
    };
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: `Question must be 1000 characters or fewer (currently ${question.length}).`,
    };
  }

  return { valid: true };
}
