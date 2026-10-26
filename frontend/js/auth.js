/**
 * Modus Auth - Auth Service (Client)
 *
 * Handles login, registration, and password recovery via the Express backend REST API.
 * Uses centralized api.js client.
 */

import { api } from './api.js';
import { Validator } from './validation.js';

export const Auth = {
  /**
   * Log in a user via POST /api/auth/login.
   *
   * @param {{ identifier: string, password: string }} credentials
   * @returns {Promise<{ user: object, token: string }>}
   */
  async login({ identifier, password }) {
    // 1. Basic client-side field validation
    const errors = Validator.validateLogin({ identifier, password });
    if (Object.keys(errors).length) {
      const err = new Error(Object.values(errors)[0]);
      err.fields = errors;
      throw err;
    }

    try {
      // 2. Call backend API
      const res = await api.login({ identifier, password });

      // 3. Persist session
      api.setToken(res.token);
      api.setCurrentUser(res.user);

      // Keep legacy session key for older code paths if any
      sessionStorage.setItem('modus_session', JSON.stringify(res.user));

      return res;
    } catch (err) {
      // Map server validation details to field-specific UI errors
      if (err.details && Array.isArray(err.details)) {
        err.fields = {};
        err.details.forEach(d => {
          if (d.field) err.fields[d.field] = d.message;
        });
      }
      throw err;
    }
  },

  /**
   * Register a new user via POST /api/auth/signup.
   *
   * @param {{ username: string, email: string, password: string, confirmPassword: string }} data
   * @returns {Promise<{ user: object, token: string, message: string }>}
   */
  async signup({ username, email, password, confirmPassword }) {
    // 1. Client-side field validation
    const errors = Validator.validateSignup({ username, email, password, confirmPassword });
    if (Object.keys(errors).length) {
      const err = new Error(Object.values(errors)[0]);
      err.fields = errors;
      throw err;
    }

    try {
      // 2. Call backend API
      const res = await api.signup({ username, email, password, confirmPassword });
      return res;
    } catch (err) {
      if (err.details && Array.isArray(err.details)) {
        err.fields = {};
        err.details.forEach(d => {
          if (d.field) err.fields[d.field] = d.message;
        });
      }
      throw err;
    }
  },

  /**
   * Trigger password recovery flow via POST /api/auth/forgot-password.
   *
   * @param {{ email: string }} data
   * @returns {Promise<{ message: string }>}
   */
  async recoverPassword({ email }) {
    const errors = Validator.validateForgotPassword({ email });
    if (Object.keys(errors).length) {
      const err = new Error(errors.email);
      err.fields = errors;
      throw err;
    }

    try {
      const res = await api.forgotPassword({ email });
      return res;
    } catch (err) {
      if (err.details && Array.isArray(err.details)) {
        err.fields = {};
        err.details.forEach(d => {
          if (d.field) err.fields[d.field] = d.message;
        });
      }
      throw err;
    }
  },

  /**
   * Log out current user and clear tokens.
   */
  logout() {
    api.logout();
  },
};

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

export default Auth;