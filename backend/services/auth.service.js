/**
 * backend/services/auth.service.js
 *
 * Authentication business logic.
 * All DB interaction and JWT signing lives here.
 * Controllers call these functions and only deal with HTTP req/res.
 *
 * Methods:
 *   signup(data)         → { user, token }
 *   login(data)          → { user, token }
 *   getUserById(id)      → User document
 *   signToken(user)      → JWT string
 */

'use strict';

const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const ApiError = require('../utils/ApiError');
const env      = require('../config/env');

// ── Token Signing ─────────────────────────────────────────────────────────────

/**
 * Sign a JWT containing safe user fields.
 * @param {UserDocument} user
 * @returns {string} signed JWT
 */
function signToken(user) {
    return jwt.sign(
        {
            userId:   user._id.toString(),
            username: user.username,
            email:    user.email,
            role:     user.role || 'user',
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    );
}

// ── Signup ────────────────────────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * @param {{ username: string, email: string, password: string }} data
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {ApiError} 409 if email or username already taken
 */
async function signup({ username, email, password }) {
    // 1. Check for existing email
    const emailExists = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (emailExists) {
        throw new ApiError(409, 'An account with this email already exists.', {
            field: 'email', message: 'Email already registered.',
        });
    }

    // 2. Check for existing username
    const usernameExists = await User.findOne({
        username: { $regex: new RegExp(`^${escapeRegex(username.trim())}$`, 'i') }
    }).lean();
    if (usernameExists) {
        throw new ApiError(409, 'Username already taken. Choose another.', {
            field: 'username', message: 'Username already taken.',
        });
    }

    // 3. Create user — password virtual triggers pre-save hash
    const user = new User({ username: username.trim(), email: email.trim() });
    user.password = password; // triggers pre-save hook bcrypt hash
    await user.save();

    // 4. Sign token
    const token = signToken(user);

    return { user: user.toPublic(), token };
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate an existing user by email or username + password.
 *
 * @param {{ identifier: string, password: string }} data
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {ApiError} 401 if credentials are invalid
 */
async function login({ identifier, password }) {
    const id = identifier.trim().toLowerCase();

    // 1. Find user by email or username — explicitly select passwordHash
    const user = await User.findOne({
        $or: [
            { email: id },
            { username: { $regex: new RegExp(`^${escapeRegex(id)}$`, 'i') } },
        ],
    }).select('+passwordHash');

    if (!user) {
        // Deliberate vague message — don't reveal whether email/username exists
        throw new ApiError(401, 'Invalid credentials. Please check your details and try again.', {
            field: 'identifier', message: 'No account found with this email or username.',
        });
    }

    // 2. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid credentials. Please check your details and try again.', {
            field: 'password', message: 'Incorrect password.',
        });
    }

    // 3. Sign and return
    const token = signToken(user);

    return { user: user.toPublic(), token };
}

// ── Get Current User ──────────────────────────────────────────────────────────

/**
 * Fetch a user document by ID (for the /me endpoint).
 * @param {string} userId
 * @returns {Promise<UserDocument>}
 * @throws {ApiError} 404 if user not found (deleted account edge case)
 */
async function getUserById(userId) {
    const user = await User.findById(userId).select('-__v').lean();
    if (!user) {
        throw ApiError.notFound('User account not found.');
    }
    return user;
}

// ── Forgot Password ───────────────────────────────────────────────────────────

/**
 * Simulate a forgot-password flow.
 * Checks that the email is registered; in a real system this would
 * send an email with a reset link.
 *
 * @param {{ email: string }} data
 * @returns {Promise<{ message: string }>}
 */
async function forgotPassword({ email }) {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();

    // Always return success — don't confirm if email exists (security best practice)
    // In production: send password reset email here
    if (user) {
        console.log(`[AuthService] Password reset requested for: ${email}`);
        // TODO: generate reset token, send email
    }

    return {
        message: `If an account with ${email} exists, a recovery email has been sent.`,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { signToken, signup, login, getUserById, forgotPassword };
