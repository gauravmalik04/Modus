/**
 * Modus - Authentication Service Interface
 * Modular contract and dispatcher for authentication operations.
 * Connected to dat/user.json and StorageService user store.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const ValidationService = require('./validation.js');
    const StorageService = require('./storage.js');
    module.exports = factory(ValidationService, StorageService);
  } else {
    root.AuthService = factory(root.ValidationService, root.StorageService);
  }
})(typeof self !== 'undefined' ? self : this, function (ValidationService, StorageService) {
  'use strict';

  // API endpoint placeholders for future backend integration
  const ENDPOINTS = {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    RECOVER: '/api/auth/recover-password',
    DATA_FILE: 'dat/user.json'
  };

  /**
   * Dispatches login request against user store
   * @param {{ identifier: string, password: string, rememberMe?: boolean }} credentials
   * @returns {Promise<{ success: boolean, user: object, message?: string }>}
   */
  async function login(credentials) {
    const validator = ValidationService || (typeof window !== 'undefined' ? window.ValidationService : null);
    const storage = StorageService || (typeof window !== 'undefined' ? window.StorageService : null);

    // 1. Run client-side form validation
    if (validator) {
      const validation = validator.validateLoginForm(credentials);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        const error = new Error(firstError);
        error.errors = validation.errors;
        throw error;
      }
    }

    // 2. Lookup user in user store
    if (storage) {
      const user = storage.findUserByIdentifier(credentials.identifier);
      if (!user) {
        throw new Error('Account not found. Please check your username/email or sign up.');
      }

      if (user.password !== credentials.password) {
        throw new Error('Invalid password. Please try again.');
      }

      const authUser = {
        id: user.id,
        username: user.username,
        email: user.email
      };

      // Set active session
      storage.setCurrentUser(authUser);

      return {
        success: true,
        user: authUser,
        message: `Welcome back, ${user.username}!`
      };
    }

    return {
      success: true,
      user: { username: credentials.identifier },
      message: 'Logged in successfully.'
    };
  }

  /**
   * Dispatches signup request and saves user to store
   * @param {{
   *   username: string,
   *   email: string,
   *   password: string,
   *   confirmPassword: string,
   *   terms: boolean
   * }} payload
   * @returns {Promise<{ success: boolean, user: object, message?: string }>}
   */
  async function signup(payload) {
    const validator = ValidationService || (typeof window !== 'undefined' ? window.ValidationService : null);
    const storage = StorageService || (typeof window !== 'undefined' ? window.StorageService : null);

    // 1. Run client-side form validation
    if (validator) {
      const validation = validator.validateSignupForm(payload);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        const error = new Error(firstError);
        error.errors = validation.errors;
        throw error;
      }
    }

    // 2. Check for duplicate username or email
    if (storage) {
      if (storage.isUsernameTaken(payload.username)) {
        const error = new Error('Username is already taken. Please choose another.');
        error.errors = { username: 'Username is already taken.' };
        throw error;
      }

      if (storage.isEmailTaken(payload.email)) {
        const error = new Error('An account with this email already exists.');
        error.errors = { email: 'Email already registered.' };
        throw error;
      }

      // 3. Save new user record
      const newUser = storage.addUser({
        username: payload.username,
        email: payload.email,
        password: payload.password
      });

      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        },
        message: 'Account created successfully! You can now log in.'
      };
    }

    return {
      success: true,
      user: { username: payload.username, email: payload.email },
      message: 'Account created successfully!'
    };
  }

  /**
   * Dispatches password recovery request
   * @param {{ email: string }} payload
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  async function recoverPassword(payload) {
    const validator = ValidationService || (typeof window !== 'undefined' ? window.ValidationService : null);
    const storage = StorageService || (typeof window !== 'undefined' ? window.StorageService : null);

    // 1. Run client-side form validation
    if (validator) {
      const validation = validator.validateForgotPasswordForm(payload);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        const error = new Error(firstError);
        error.errors = validation.errors;
        throw error;
      }
    }

    // 2. Verify email in store
    if (storage) {
      const exists = storage.isEmailTaken(payload.email);
      if (!exists) {
        throw new Error('No account found associated with this email address.');
      }
    }

    return {
      success: true,
      message: `A password reset link has been dispatched to ${payload.email}.`
    };
  }

  return {
    ENDPOINTS,
    login,
    signup,
    recoverPassword
  };
});
