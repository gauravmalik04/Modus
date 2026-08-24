/**
 * Modus - Storage Utility Service
 * Safe wrapper around localStorage and dat/user.json for auth data, user store, and active session.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StorageService = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const USERS_STORAGE_KEY = 'modus_auth_users_store';
  const USER_DATA_FILE = 'dat/user.json';
  const CURRENT_USER_KEY = 'modus_auth_current_user';

  // Seed default users in case file fetch is not available (e.g. file:// protocol)
  const DEFAULT_SEED_USERS = [
    {
      id: 'usr_001',
      username: 'jane_doe',
      email: 'user@bauhaus.io',
      password: 'Password123!',
      createdAt: '2026-08-24T12:00:00.000Z'
    }
  ];

  // In-memory fallback dictionary
  const memoryStore = {};

  /**
   * Safely gets item from localStorage with in-memory fallback
   * @param {string} key
   * @returns {string|null}
   */
  function getItem(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // localStorage disabled or restricted
    }
    return memoryStore[key] !== undefined ? memoryStore[key] : null;
  }

  /**
   * Safely sets item in localStorage with in-memory fallback
   * @param {string} key
   * @param {string} value
   */
  function setItem(key, value) {
    memoryStore[key] = String(value);
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      // localStorage disabled or restricted
    }
  }

  /**
   * Safely removes item from localStorage with in-memory fallback
   * @param {string} key
   */
  function removeItem(key) {
    delete memoryStore[key];
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // localStorage disabled or restricted
    }
  }

  /**
   * Sets the currently authenticated user session
   * @param {object} user
   */
  function setCurrentUser(user) {
    if (user) {
      setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      removeItem(CURRENT_USER_KEY);
    }
  }

  /**
   * Retrieves the currently authenticated user
   * @returns {object|null}
   */
  function getCurrentUser() {
    const raw = getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Clears the current user session
   */
  function clearCurrentUser() {
    removeItem(CURRENT_USER_KEY);
  }

  /**
   * Retrieves all users from localStorage or default seed
   * @returns {Array<object>}
   */
  function getUsers() {
    const raw = getItem(USERS_STORAGE_KEY);
    if (!raw) {
      const initial = JSON.parse(JSON.stringify(DEFAULT_SEED_USERS));
      setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : JSON.parse(JSON.stringify(DEFAULT_SEED_USERS));
    } catch (e) {
      console.warn('StorageService: Corrupted users store, resetting to seed data.', e);
      const initial = JSON.parse(JSON.stringify(DEFAULT_SEED_USERS));
      setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
  }

  /**
   * Loads and syncs users from dat/user.json when running over HTTP
   * @returns {Promise<Array<object>>}
   */
  async function syncUsersFromFile() {
    try {
      const response = await fetch(USER_DATA_FILE);
      if (response.ok) {
        const fileUsers = await response.json();
        if (Array.isArray(fileUsers)) {
          const currentUsers = getUsers();
          // Merge users without duplicates by id or email
          const merged = [...currentUsers];
          fileUsers.forEach((fu) => {
            const exists = merged.some(
              (u) => (u.id && u.id === fu.id) || (u.email && u.email.toLowerCase() === fu.email.toLowerCase())
            );
            if (!exists) {
              merged.push(fu);
            }
          });
          setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {
      // Fetch might fail under file:// protocol or offline, gracefully fallback to local store
    }
    return getUsers();
  }

  /**
   * Adds a new user to the store
   * @param {{ username: string, email: string, password: string }} userData
   * @returns {object} The created user object
   */
  function addUser(userData) {
    const users = getUsers();
    const newUser = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
      username: userData.username.trim(),
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return newUser;
  }

  /**
   * Finds a user by email or username (case-insensitive)
   * @param {string} identifier
   * @returns {object|null}
   */
  function findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const cleanId = identifier.trim().toLowerCase();
    const users = getUsers();
    return (
      users.find(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanId) ||
          (u.username && u.username.toLowerCase() === cleanId)
      ) || null
    );
  }

  /**
   * Checks if an email is already registered
   * @param {string} email
   * @returns {boolean}
   */
  function isEmailTaken(email) {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();
    const users = getUsers();
    return users.some((u) => u.email && u.email.toLowerCase() === cleanEmail);
  }

  /**
   * Checks if a username is already registered
   * @param {string} username
   * @returns {boolean}
   */
  function isUsernameTaken(username) {
    if (!username) return false;
    const cleanUsername = username.trim().toLowerCase();
    const users = getUsers();
    return users.some((u) => u.username && u.username.toLowerCase() === cleanUsername);
  }

  // Attempt initial sync
  if (typeof window !== 'undefined') {
    syncUsersFromFile();
  }

  return {
    getItem,
    setItem,
    removeItem,
    setCurrentUser,
    getCurrentUser,
    clearCurrentUser,
    getUsers,
    syncUsersFromFile,
    addUser,
    findUserByIdentifier,
    isEmailTaken,
    isUsernameTaken
  };
});
