/**
 * Simple email validation utility
 * Checks basic email format: something@something.something
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address
 * @param email - Email string to validate
 * @returns true if email format is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
