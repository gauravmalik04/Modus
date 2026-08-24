/**
 * Modus Auth - Validation
 * Simple, clean client-side validation for login, signup, and forgot password forms.
 */

const Validator = (() => {

  // Email regex (RFC 5322 simplified)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Username: 3–20 chars, letters/numbers/underscores only
  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

  function validateEmail(email) {
    if (!email) return 'Email is required.';
    if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
    return null;
  }

  function validateUsername(username) {
    if (!username) return 'Username is required.';
    if (username.length < 3) return 'Username must be at least 3 characters.';
    if (username.length > 20) return 'Username must be 20 characters or less.';
    if (!USERNAME_RE.test(username)) return 'Only letters, numbers and underscores allowed.';
    return null;
  }

  function validatePassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    return null;
  }

  /**
   * Returns a score 0–4 for password strength
   */
  function passwordStrength(password) {
    let score = 0;
    if (!password) return score;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  }

  function validateLogin({ identifier, password }) {
    const errors = {};
    if (!identifier || !identifier.trim()) errors.identifier = 'Email or username is required.';
    if (!password) errors.password = 'Password is required.';
    return errors;
  }

  function validateSignup({ username, email, password, confirmPassword }) {
    const errors = {};
    const usernameErr = validateUsername((username || '').trim());
    if (usernameErr) errors.username = usernameErr;

    const emailErr = validateEmail((email || '').trim());
    if (emailErr) errors.email = emailErr;

    const passwordErr = validatePassword(password || '');
    if (passwordErr) errors.password = passwordErr;

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return errors;
  }

  function validateForgotPassword({ email }) {
    const errors = {};
    const emailErr = validateEmail((email || '').trim());
    if (emailErr) errors.email = emailErr;
    return errors;
  }

  return { validateEmail, validateUsername, validatePassword, passwordStrength, validateLogin, validateSignup, validateForgotPassword };

})();
