// Feature: image-qa-app
// Image_Validator — client-side file validation (MIME type + size)

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates an image File before upload.
 *
 * @param {File} file - The file selected by the user.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validate(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type}". Accepted formats: image/jpeg, image/png, image/gif, image/webp.`,
    };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: "File exceeds the 5 MB limit. Please choose a smaller image.",
    };
  }

  return { valid: true };
}
