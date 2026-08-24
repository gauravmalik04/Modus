/**
 * Modus - Authentication Page Controller
 * Handles view routing (Login, Signup, Recover), real-time validation,
 * password visibility toggles, strength indicator, and form submissions.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Dependencies
  const Validator = window.ValidationService;
  const Storage = window.StorageService;
  const Auth = window.AuthService;

  // View Containers
  const views = {
    login: document.getElementById('login-view'),
    signup: document.getElementById('signup-view'),
    forgot: document.getElementById('forgot-view')
  };

  const authContainer = document.getElementById('auth-container');

  // Forms
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const forgotForm = document.getElementById('forgot-form');

  // Alert Banners
  const alerts = {
    login: {
      banner: document.getElementById('login-alert'),
      text: document.getElementById('login-alert-text')
    },
    signup: {
      banner: document.getElementById('signup-alert'),
      text: document.getElementById('signup-alert-text')
    },
    forgot: {
      banner: document.getElementById('forgot-alert'),
      text: document.getElementById('forgot-alert-text')
    }
  };

  // Strength Meter Elements
  const signupPasswordInput = document.getElementById('signup-password');
  const strengthBars = [
    document.getElementById('str-bar-1'),
    document.getElementById('str-bar-2'),
    document.getElementById('str-bar-3'),
    document.getElementById('str-bar-4')
  ];
  const strengthLabel = document.getElementById('strength-label');

  // -------------------------------------------------------------------------
  // 1. VIEW ROUTING & NAVIGATION
  // -------------------------------------------------------------------------

  /**
   * Switches the active view (login, signup, forgot)
   * @param {'login'|'signup'|'forgot'} viewName
   * @param {boolean} updateHistory
   */
  function showView(viewName, updateHistory = true) {
    if (!views[viewName]) {
      viewName = 'login';
    }

    // Hide all views & clear existing banners
    Object.keys(views).forEach((key) => {
      const view = views[key];
      if (view) {
        view.classList.remove('active');
        clearAlert(key);
      }
    });

    // Show target view
    const targetView = views[viewName];
    if (targetView) {
      targetView.classList.add('active');
    }

    // Adjust container width for wider forms (e.g. signup)
    if (viewName === 'signup') {
      authContainer.classList.add('wide');
    } else {
      authContainer.classList.remove('wide');
    }

    // Update browser URL hash
    if (updateHistory) {
      window.location.hash = viewName;
    }

    // Autofocus first input in the new view
    setTimeout(() => {
      const firstInput = targetView.querySelector('input:not([type="checkbox"]):not([type="hidden"])');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }

  // Handle Hash Changes
  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'signup') {
      showView('signup', false);
    } else if (hash === 'forgot' || hash === 'recover') {
      showView('forgot', false);
    } else {
      showView('login', false);
    }
  }

  window.addEventListener('hashchange', handleHashRoute);

  // Link event bindings for smooth switching and data sharing
  const toSignupBtn = document.getElementById('to-signup-btn');
  if (toSignupBtn) {
    toSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showView('signup');
    });
  }

  const toLoginFromSignup = document.getElementById('to-login-from-signup');
  if (toLoginFromSignup) {
    toLoginFromSignup.addEventListener('click', (e) => {
      e.preventDefault();
      showView('login');
    });
  }

  const toForgotBtn = document.getElementById('to-forgot-btn');
  if (toForgotBtn) {
    toForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const loginIdentifier = document.getElementById('login-identifier')?.value.trim() || '';
      const forgotEmailInput = document.getElementById('forgot-email');
      if (forgotEmailInput && loginIdentifier.includes('@')) {
        forgotEmailInput.value = loginIdentifier;
      }
      showView('forgot');
    });
  }

  const toLoginFromForgot = document.getElementById('to-login-from-forgot');
  if (toLoginFromForgot) {
    toLoginFromForgot.addEventListener('click', (e) => {
      e.preventDefault();
      showView('login');
    });
  }

  // -------------------------------------------------------------------------
  // 2. ALERT & ERROR RENDERING
  // -------------------------------------------------------------------------

  /**
   * Displays an alert banner on a specific view
   * @param {'login'|'signup'|'forgot'} view
   * @param {string} message
   * @param {'error'|'success'} type
   */
  function showAlert(view, message, type = 'error') {
    const alertObj = alerts[view];
    if (!alertObj || !alertObj.banner) return;

    alertObj.banner.className = `auth-alert ${type} visible`;
    if (alertObj.text) {
      alertObj.text.textContent = message;
    }
    const icon = alertObj.banner.querySelector('.alert-icon');
    if (icon) {
      icon.textContent = type === 'error' ? 'error' : 'check_circle';
    }
  }

  /**
   * Clears the alert banner on a specific view
   * @param {'login'|'signup'|'forgot'} view
   */
  function clearAlert(view) {
    const alertObj = alerts[view];
    if (!alertObj || !alertObj.banner) return;
    alertObj.banner.className = 'auth-alert';
    if (alertObj.text) {
      alertObj.text.textContent = '';
    }
  }

  /**
   * Shows an inline field error
   * @param {string} fieldId
   * @param {string} message
   */
  function setFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  /**
   * Clears an inline field error
   * @param {string} fieldId
   */
  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (input) {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
  }

  /**
   * Clears all field errors within a container
   * @param {HTMLElement} container
   */
  function clearAllFieldErrors(container) {
    if (!container) return;
    const inputs = container.querySelectorAll('.neo-input, .brutal-checkbox');
    inputs.forEach((input) => {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    });
    const errorMsgs = container.querySelectorAll('.field-error-msg');
    errorMsgs.forEach((msg) => {
      msg.textContent = '';
      msg.classList.remove('visible');
    });
  }

  // -------------------------------------------------------------------------
  // 3. PASSWORD VISIBILITY TOGGLES
  // -------------------------------------------------------------------------

  const passwordToggles = document.querySelectorAll('.password-toggle-btn');
  passwordToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      const iconSpan = btn.querySelector('.material-symbols-outlined');

      if (!targetInput) return;

      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';

      if (iconSpan) {
        iconSpan.textContent = isPassword ? 'visibility_off' : 'visibility';
      }

      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });

  // -------------------------------------------------------------------------
  // 4. PASSWORD STRENGTH METER
  // -------------------------------------------------------------------------

  if (signupPasswordInput && Validator) {
    signupPasswordInput.addEventListener('input', (e) => {
      const password = e.target.value;
      const evaluation = Validator.validatePassword(password);
      const score = evaluation.score;

      // Reset bars
      strengthBars.forEach((bar) => {
        if (bar) bar.className = 'strength-bar';
      });

      // Apply stepped colors matching Bauhaus palette
      const levelClasses = ['lvl-red', 'lvl-yellow', 'lvl-black', 'lvl-blue'];
      for (let i = 0; i < score; i++) {
        if (strengthBars[i]) {
          strengthBars[i].classList.add(levelClasses[i]);
        }
      }

      // Update strength text label
      if (strengthLabel) {
        if (password.length === 0) {
          strengthLabel.textContent = 'STRENGTH: REQUIRED (8+ CHARS)';
          strengthLabel.style.color = 'var(--color-on-surface-variant)';
        } else {
          strengthLabel.textContent = `STRENGTH: ${evaluation.label.toUpperCase()}`;
          if (score === 1) strengthLabel.style.color = 'var(--color-accent-red)';
          else if (score === 2) strengthLabel.style.color = '#c29000';
          else if (score === 3) strengthLabel.style.color = 'var(--color-primary)';
          else if (score === 4) strengthLabel.style.color = 'var(--color-accent-blue)';
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 5. LIVE REAL-TIME INPUT VALIDATION BINDINGS
  // -------------------------------------------------------------------------

  // Auto-clear errors on field input
  const allInputs = document.querySelectorAll('.neo-input, .brutal-checkbox');
  allInputs.forEach((input) => {
    input.addEventListener('input', () => {
      clearFieldError(input.id);
    });
    input.addEventListener('change', () => {
      clearFieldError(input.id);
    });
  });

  // -------------------------------------------------------------------------
  // 6. INITIAL ROUTING
  // -------------------------------------------------------------------------

  handleHashRoute();

  // -------------------------------------------------------------------------
  // 7. FORM SUBMISSIONS
  // -------------------------------------------------------------------------

  // --- LOGIN SUBMISSION ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert('login');
      clearAllFieldErrors(loginForm);

      const identifier = document.getElementById('login-identifier')?.value || '';
      const password = document.getElementById('login-password')?.value || '';

      // Validate
      if (Validator) {
        const validation = Validator.validateLoginForm({ identifier, password });
        if (!validation.isValid) {
          if (validation.errors.identifier) setFieldError('login-identifier', validation.errors.identifier);
          if (validation.errors.password) setFieldError('login-password', validation.errors.password);
          showAlert('login', 'Please fill in all required credentials.');
          return;
        }
      }

      // Submit state
      const submitBtn = document.getElementById('login-submit-btn');
      submitBtn.classList.add('is-loading');

      try {
        let res;
        if (Auth) {
          res = await Auth.login({ identifier, password });
        }
        const username = res?.user?.username || identifier;
        showAlert('login', `Welcome back, ${username}! Redirecting to playlists...`, 'success');
        
        // Redirect to playlists.html after short visual feedback
        setTimeout(() => {
          window.location.href = 'playlists.html';
        }, 500);
      } catch (err) {
        if (err.errors) {
          Object.keys(err.errors).forEach((key) => {
            const inputId = `login-${key}`;
            setFieldError(inputId, err.errors[key]);
          });
        }
        showAlert('login', err.message || 'Login failed. Please check your credentials.');
        submitBtn.classList.remove('is-loading');
      }
    });
  }

  // --- SIGNUP SUBMISSION ---
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert('signup');
      clearAllFieldErrors(signupForm);

      const username = document.getElementById('signup-username')?.value || '';
      const email = document.getElementById('signup-email')?.value || '';
      const password = document.getElementById('signup-password')?.value || '';
      const confirmPassword = document.getElementById('signup-confirm-password')?.value || '';
      const terms = document.getElementById('signup-terms')?.checked || false;

      // Validate
      if (Validator) {
        const validation = Validator.validateSignupForm({
          username,
          email,
          password,
          confirmPassword,
          terms
        });

        if (!validation.isValid) {
          if (validation.errors.username) setFieldError('signup-username', validation.errors.username);
          if (validation.errors.email) setFieldError('signup-email', validation.errors.email);
          if (validation.errors.password) setFieldError('signup-password', validation.errors.password);
          if (validation.errors.confirmPassword) setFieldError('signup-confirm-password', validation.errors.confirmPassword);
          if (validation.errors.terms) setFieldError('signup-terms', validation.errors.terms);

          const firstErrorMsg = Object.values(validation.errors)[0];
          showAlert('signup', firstErrorMsg);
          return;
        }
      }

      // Submit state
      const submitBtn = document.getElementById('signup-submit-btn');
      submitBtn.classList.add('is-loading');

      try {
        let res;
        if (Auth) {
          res = await Auth.signup({ username, email, password, confirmPassword, terms });
        }
        
        // Reset signup form
        signupForm.reset();
        if (strengthBars) {
          strengthBars.forEach((bar) => { if (bar) bar.className = 'strength-bar'; });
        }
        if (strengthLabel) {
          strengthLabel.textContent = 'STRENGTH: REQUIRED (8+ CHARS)';
          strengthLabel.style.color = 'var(--color-on-surface-variant)';
        }

        // Open Login view immediately
        showView('login');

        // Prefill login identifier with newly created username/email
        const loginIdentifierInput = document.getElementById('login-identifier');
        if (loginIdentifierInput) {
          loginIdentifierInput.value = email || username;
        }

        // Focus password input for instant login
        const loginPasswordInput = document.getElementById('login-password');
        if (loginPasswordInput) {
          loginPasswordInput.focus();
        }

        // Display success banner on login card
        showAlert('login', res?.message || 'Account created successfully! Please enter your password to login.', 'success');
      } catch (err) {
        if (err.errors) {
          Object.keys(err.errors).forEach((key) => {
            const inputId = `signup-${key}`;
            setFieldError(inputId, err.errors[key]);
          });
        }
        showAlert('signup', err.message || 'Signup failed.');
      } finally {
        submitBtn.classList.remove('is-loading');
      }
    });
  }

  // --- FORGOT PASSWORD SUBMISSION ---
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert('forgot');
      clearAllFieldErrors(forgotForm);

      const email = document.getElementById('forgot-email')?.value || '';

      // Validate
      if (Validator) {
        const validation = Validator.validateForgotPasswordForm({ email });
        if (!validation.isValid) {
          if (validation.errors.email) setFieldError('forgot-email', validation.errors.email);
          showAlert('forgot', validation.errors.email);
          return;
        }
      }

      // Submit state
      const submitBtn = document.getElementById('forgot-submit-btn');
      submitBtn.classList.add('is-loading');

      try {
        let res;
        if (Auth) {
          res = await Auth.recoverPassword({ email });
        }
        showAlert('forgot', res?.message || `Recovery link dispatched to ${email}.`, 'success');
      } catch (err) {
        if (err.errors) {
          Object.keys(err.errors).forEach((key) => {
            const inputId = `forgot-${key}`;
            setFieldError(inputId, err.errors[key]);
          });
        }
        showAlert('forgot', err.message || 'Password recovery validation failed.');
      } finally {
        submitBtn.classList.remove('is-loading');
      }
    });
  }
});
