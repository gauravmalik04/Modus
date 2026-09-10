/**
 * Modus Auth - Auth
 * Login, signup, and password recovery logic.
 * Depends on: Validator, AuthStorage (loaded before this script).
 */

const Auth = (() => {

  /**
   * Login a user.
   * @returns {{ user: object }} on success
   * @throws  Error with message on failure
   */
  function login({ identifier, password }) {
    // 1. Basic field validation
    const errors = Validator.validateLogin({ identifier, password });
    if (Object.keys(errors).length) {
      const err = new Error(Object.values(errors)[0]);
      err.fields = errors;
      throw err;
    }

    // 2. Find account
    const user = AuthStorage.findUser(identifier);
    if (!user) {
      throw Object.assign(new Error('No account found. Check your details or sign up.'), {
        fields: { identifier: 'No account with this email or username.' }
      });
    }

    // 3. Check password
    if (user.password !== password) {
      throw Object.assign(new Error('Incorrect password. Please try again.'), {
        fields: { password: 'Incorrect password.' }
      });
    }

    // 4. Start session
    AuthStorage.setSession(user);
    return { user };
  }

  /**
   * Register a new user.
   * @returns {{ user: object, message: string }} on success
   * @throws  Error with message on failure
   */
  function signup({ username, email, password, confirmPassword }) {
    // 1. Validate fields
    const errors = Validator.validateSignup({ username, email, password, confirmPassword });
    if (Object.keys(errors).length) {
      const err = new Error(Object.values(errors)[0]);
      err.fields = errors;
      throw err;
    }

    // 2. Duplicate checks
    if (AuthStorage.isUsernameTaken(username)) {
      throw Object.assign(new Error('Username already taken. Choose another.'), {
        fields: { username: 'Username already taken.' }
      });
    }
    if (AuthStorage.isEmailTaken(email)) {
      throw Object.assign(new Error('An account with this email already exists.'), {
        fields: { email: 'Email already registered.' }
      });
    }

    // 3. Save
    const user = AuthStorage.addUser({ username, email, password });
    return { user, message: 'Account created! You can now log in.' };
  }

  /**
   * Simulate password recovery — checks that the email is registered.
   */
  function recoverPassword({ email }) {
    const errors = Validator.validateForgotPassword({ email });
    if (Object.keys(errors).length) {
      const err = new Error(errors.email);
      err.fields = errors;
      throw err;
    }

    if (!AuthStorage.isEmailTaken(email)) {
      throw Object.assign(new Error('No account found with that email.'), {
        fields: { email: 'Email not registered.' }
      });
    }

    return { message: `Recovery instructions sent to ${email.trim()}.` };
  }

  return { login, signup, recoverPassword };

})();