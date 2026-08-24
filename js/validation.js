/**
 * Modus - Client-side Form Validation Utilities
 * Modular validation rules and helpers for authentication forms.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ValidationService = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // RFC 5322 standard email regex pattern
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Username: 3-30 chars, alphanumeric, underscores, hyphens
  const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

  /**
   * Validates if a string is non-empty after trimming
   * @param {string} value
   * @returns {boolean}
   */
  function isNotEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Validates email format
   * @param {string} email
   * @returns {boolean}
   */
  function validateEmail(email) {
    if (!isNotEmpty(email)) return false;
    return EMAIL_REGEX.test(email.trim());
  }

  /**
   * Validates username or display name
   * @param {string} username
   * @returns {{ isValid: boolean, message: string }}
   */
  function validateUsername(username) {
    if (!isNotEmpty(username)) {
      return { isValid: false, message: 'Username is required.' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return { isValid: false, message: 'Username must be at least 3 characters.' };
    }
    if (trimmed.length > 30) {
      return { isValid: false, message: 'Username cannot exceed 30 characters.' };
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      return { isValid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens.' };
    }
    return { isValid: true, message: '' };
  }

  /**
   * Evaluates password strength and satisfies project password requirements:
   * Minimum 8 characters, at least 1 letter and 1 number/special character.
   * @param {string} password
   * @returns {{
   *   isValid: boolean,
   *   score: number, // 0 to 4
   *   label: string, // 'Weak', 'Fair', 'Good', 'Strong'
   *   message: string,
   *   checks: { length: boolean, hasNumber: boolean, hasSpecial: boolean, hasUpper: boolean, hasLower: boolean }
   * }}
   */
  function validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        score: 0,
        label: 'Empty',
        message: 'Password is required.',
        checks: { length: false, hasNumber: false, hasSpecial: false, hasUpper: false, hasLower: false }
      };
    }

    const checks = {
      length: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password)
    };

    let score = 0;
    if (password.length > 0) score = 1;
    if (checks.length) score++;
    if ((checks.hasNumber || checks.hasSpecial) && (checks.hasUpper || checks.hasLower)) score++;
    if (checks.length && checks.hasNumber && checks.hasSpecial && checks.hasUpper && checks.hasLower) score++;

    // Clamp score 0-4
    score = Math.min(4, Math.max(0, score));

    const labels = ['Empty', 'Weak', 'Fair', 'Good', 'Strong'];
    const label = labels[score];

    // Satisfies project requirement: at least 8 chars
    let isValid = checks.length;
    let message = '';

    if (!checks.length) {
      message = 'Password must be at least 8 characters long.';
    }

    return {
      isValid,
      score,
      label,
      message,
      checks
    };
  }

  /**
   * Validates if confirm password matches password
   * @param {string} password
   * @param {string} confirmPassword
   * @returns {{ isValid: boolean, message: string }}
   */
  function validatePasswordMatch(password, confirmPassword) {
    if (!isNotEmpty(confirmPassword)) {
      return { isValid: false, message: 'Please confirm your password.' };
    }
    if (password !== confirmPassword) {
      return { isValid: false, message: 'Passwords do not match.' };
    }
    return { isValid: true, message: '' };
  }

  /**
   * Validates the complete Login form payload
   * @param {{ identifier?: string, password?: string }} fields
   * @returns {{ isValid: boolean, errors: Record<string, string> }}
   */
  function validateLoginForm(fields = {}) {
    const errors = {};
    const identifier = (fields.identifier || '').trim();
    const password = fields.password || '';

    if (!identifier) {
      errors.identifier = 'Email or username is required.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validates the complete Signup form payload
   * @param {{
   *   username?: string,
   *   email?: string,
   *   password?: string,
   *   confirmPassword?: string,
   *   terms?: boolean
   * }} fields
   * @returns {{ isValid: boolean, errors: Record<string, string> }}
   */
  function validateSignupForm(fields = {}) {
    const errors = {};
    const username = (fields.username || '').trim();
    const email = (fields.email || '').trim();
    const password = fields.password || '';
    const confirmPassword = fields.confirmPassword || '';
    const terms = Boolean(fields.terms);

    // 1. Username
    const usernameResult = validateUsername(username);
    if (!usernameResult.isValid) {
      errors.username = usernameResult.message;
    }

    // 2. Email
    if (!email) {
      errors.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    // 3. Password
    const passwordResult = validatePassword(password);
    if (!password) {
      errors.password = 'Password is required.';
    } else if (!passwordResult.isValid) {
      errors.password = passwordResult.message;
    }

    // 4. Confirm Password
    const matchResult = validatePasswordMatch(password, confirmPassword);
    if (!matchResult.isValid) {
      errors.confirmPassword = matchResult.message;
    }

    // 5. Terms
    if (!terms) {
      errors.terms = 'You must agree to the terms to proceed.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validates the Forgot Password form payload
   * @param {{ email?: string }} fields
   * @returns {{ isValid: boolean, errors: Record<string, string> }}
   */
  function validateForgotPasswordForm(fields = {}) {
    const errors = {};
    const email = (fields.email || '').trim();

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  return {
    isNotEmpty,
    validateEmail,
    validateUsername,
    validatePassword,
    validatePasswordMatch,
    validateLoginForm,
    validateSignupForm,
    validateForgotPasswordForm
  };
});
