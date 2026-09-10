/**
 * Modus Auth - Page Controller
 * Handles view switching, form submission, password toggles, and strength meter.
 * Depends on: Validator, AuthStorage, Auth (loaded before this script).
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM References ─────────────────────────────────────────────────────────

  const loginView  = document.getElementById('login-view');
  const signupView = document.getElementById('signup-view');
  const forgotView = document.getElementById('forgot-view');

  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const forgotForm = document.getElementById('forgot-form');

  // Strength meter (signup)
  const strengthBars  = [1, 2, 3, 4].map(i => document.getElementById('str-bar-' + i));
  const strengthLabel = document.getElementById('strength-label');

  // ── View Routing ───────────────────────────────────────────────────────────

  const VIEWS = { login: loginView, signup: signupView, forgot: forgotView };

  function showView(name) {
    Object.values(VIEWS).forEach(v => { if (v) v.classList.remove('active'); });
    if (VIEWS[name]) VIEWS[name].classList.add('active');
    clearAllAlerts();
    clearAllFieldErrors();
    window.location.hash = name;
  }

  function routeHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'signup') showView('signup');
    else if (hash === 'forgot') showView('forgot');
    else showView('login');
  }

  window.addEventListener('hashchange', routeHash);
  routeHash();

  // ── Alert Banners ──────────────────────────────────────────────────────────

  function showAlert(view, message, type = 'error') {
    const el   = document.getElementById(view + '-alert');
    const text = document.getElementById(view + '-alert-text');
    const icon = el?.querySelector('.alert-icon');
    if (!el || !text) return;
    text.textContent = message;
    el.className = 'auth-alert visible ' + type;
    if (icon) icon.textContent = type === 'success' ? 'check_circle' : 'error';
  }

  function clearAlert(view) {
    const el = document.getElementById(view + '-alert');
    if (el) el.className = 'auth-alert';
  }

  function clearAllAlerts() {
    ['login', 'signup', 'forgot'].forEach(clearAlert);
  }

  // ── Field Errors ───────────────────────────────────────────────────────────

  function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (input) input.classList.add('is-invalid');
    if (errEl) { errEl.textContent = message; errEl.classList.add('visible'); }
  }

  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (input) input.classList.remove('is-invalid');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
  }

  function clearAllFieldErrors() {
    document.querySelectorAll('.neo-input').forEach(i => i.classList.remove('is-invalid'));
    document.querySelectorAll('.field-error-msg').forEach(e => { e.textContent = ''; e.classList.remove('visible'); });
  }

  function applyFieldErrors(prefix, errors) {
    Object.entries(errors).forEach(([field, msg]) => showFieldError(prefix + field, msg));
  }

  // ── Password Visibility Toggles ────────────────────────────────────────────

  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input    = document.getElementById(targetId);
      const icon     = btn.querySelector('.material-symbols-outlined');
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      if (icon) icon.textContent = isHidden ? 'visibility_off' : 'visibility';
    });
  });

  // ── Password Strength Meter (signup only) ──────────────────────────────────

  const signupPasswordInput = document.getElementById('signup-password');
  const STRENGTH_LEVELS = [
    { label: 'TOO WEAK',  cls: 'lvl-red'    },
    { label: 'WEAK',      cls: 'lvl-red'    },
    { label: 'FAIR',      cls: 'lvl-yellow' },
    { label: 'STRONG',    cls: 'lvl-black'  },
    { label: 'VERY STRONG', cls: 'lvl-blue' }
  ];

  function updateStrengthMeter(score) {
    strengthBars.forEach((bar, i) => {
      if (!bar) return;
      bar.className = 'strength-bar';
      if (i < score) bar.classList.add(STRENGTH_LEVELS[score].cls);
    });
    if (strengthLabel) {
      const level = STRENGTH_LEVELS[score];
      strengthLabel.textContent = score === 0 ? 'STRENGTH: REQUIRED (8+ CHARS)' : 'STRENGTH: ' + level.label;
    }
  }

  if (signupPasswordInput) {
    signupPasswordInput.addEventListener('input', () => {
      const score = Validator.passwordStrength(signupPasswordInput.value);
      updateStrengthMeter(score);
      clearFieldError('signup-password');
    });
  }

  // ── Loading Button Helpers ─────────────────────────────────────────────────

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) btn.classList.add('is-loading');
    else btn.classList.remove('is-loading');
  }

  // ── LOGIN FORM ─────────────────────────────────────────────────────────────

  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      clearAlert('login');
      clearAllFieldErrors();

      const identifier = document.getElementById('login-identifier').value.trim();
      const password   = document.getElementById('login-password').value;

      setLoading('login-submit-btn', true);

      // Small timeout gives the loading spinner a frame to render
      setTimeout(() => {
        try {
          const { user } = Auth.login({ identifier, password });
          showAlert('login', `Welcome back, ${user.username}! Redirecting...`, 'success');
          setTimeout(() => { window.location.href = 'library.html'; }, 600);
        } catch (err) {
          if (err.fields) applyFieldErrors('login-', err.fields);
          showAlert('login', err.message);
          setLoading('login-submit-btn', false);
        }
      }, 300);
    });
  }

  // ── SIGNUP FORM ────────────────────────────────────────────────────────────

  if (signupForm) {
    signupForm.addEventListener('submit', e => {
      e.preventDefault();
      clearAlert('signup');
      clearAllFieldErrors();

      const username        = document.getElementById('signup-username').value.trim();
      const email           = document.getElementById('signup-email').value.trim();
      const password        = document.getElementById('signup-password').value;
      const confirmPassword = document.getElementById('signup-confirm-password').value;

      setLoading('signup-submit-btn', true);

      setTimeout(() => {
        try {
          const { user } = Auth.signup({ username, email, password, confirmPassword });

          // Reset form & meter
          signupForm.reset();
          updateStrengthMeter(0);

          // Switch to login and prefill identifier
          showView('login');
          const idInput = document.getElementById('login-identifier');
          if (idInput) idInput.value = email;
          document.getElementById('login-password')?.focus();
          showAlert('login', 'Account created! Enter your password to log in.', 'success');
        } catch (err) {
          if (err.fields) applyFieldErrors('signup-', err.fields);
          showAlert('signup', err.message);
        } finally {
          setLoading('signup-submit-btn', false);
        }
      }, 300);
    });
  }

  // ── FORGOT PASSWORD FORM ───────────────────────────────────────────────────

  if (forgotForm) {
    forgotForm.addEventListener('submit', e => {
      e.preventDefault();
      clearAlert('forgot');
      clearAllFieldErrors();

      const email = document.getElementById('forgot-email').value.trim();

      setLoading('forgot-submit-btn', true);

      setTimeout(() => {
        try {
          const { message } = Auth.recoverPassword({ email });
          showAlert('forgot', message, 'success');
          forgotForm.reset();
        } catch (err) {
          if (err.fields) applyFieldErrors('forgot-', err.fields);
          showAlert('forgot', err.message);
        } finally {
          setLoading('forgot-submit-btn', false);
        }
      }, 300);
    });
  }

});