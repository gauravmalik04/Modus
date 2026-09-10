/**
 * Modus Auth - Storage
 * Manages user accounts in localStorage and the active session in sessionStorage.
 *
 * localStorage key  → 'modus_users'        (array of user records, persists forever)
 * sessionStorage key → 'modus_session'      (current logged-in user, cleared on tab close)
 */

const AuthStorage = (() => {

  const USERS_KEY   = 'modus_users';
  const SESSION_KEY = 'modus_session';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // ── User Store ────────────────────────────────────────────────────────────

  function findUser(identifier) {
    const id = identifier.trim().toLowerCase();
    return getUsers().find(u =>
      u.email.toLowerCase() === id || u.username.toLowerCase() === id
    ) || null;
  }

  function isEmailTaken(email) {
    return getUsers().some(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  function isUsernameTaken(username) {
    return getUsers().some(u => u.username.toLowerCase() === username.trim().toLowerCase());
  }

  function addUser({ username, email, password }) {
    const users = getUsers();
    const newUser = {
      id:        'usr_' + Date.now().toString(36),
      username:  username.trim(),
      email:     email.trim().toLowerCase(),
      password,                              // plain-text (browser-only demo)
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  }

  // ── Session ───────────────────────────────────────────────────────────────

  /** Save logged-in user to sessionStorage (cleared when tab closes) */
  function setSession(user) {
    const safe = { id: user.id, username: user.username, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  }

  /** Get the currently logged-in user, or null */
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  }

  /** Clear the session (logout) */
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  return { getUsers, findUser, isEmailTaken, isUsernameTaken, addUser, setSession, getSession, clearSession };

})();