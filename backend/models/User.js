/**
 * backend/models/User.js
 *
 * Mongoose schema for the `users` collection.
 *
 * Responsibilities:
 *   - Store user identity (username, email, passwordHash)
 *   - Pre-save hook: auto-hash plain-text password before storing
 *   - Instance method: comparePassword() for login verification
 *   - Never expose passwordHash in API responses (use toJSON transform)
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SALT_ROUNDS = 12;

// ── Schema ────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
    {
        username: {
            type:     String,
            required: [true, 'Username is required.'],
            unique:   true,
            trim:     true,
            minlength: [3, 'Username must be at least 3 characters.'],
            maxlength: [30, 'Username cannot exceed 30 characters.'],
            match: [
                /^[a-zA-Z0-9_.-]+$/,
                'Username can only contain letters, numbers, underscores, dots, and hyphens.',
            ],
        },

        email: {
            type:      String,
            required:  [true, 'Email is required.'],
            unique:    true,
            lowercase: true,
            trim:      true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address.'],
        },

        passwordHash: {
            type:     String,
            required: [true, 'Password is required.'],
            select:   false, // never returned in queries by default
        },

        // Reserved for future role-based access control
        role: {
            type:    String,
            enum:    ['user', 'admin'],
            default: 'user',
        },
    },
    {
        timestamps: true, // adds createdAt + updatedAt automatically
        toJSON: {
            // Strip passwordHash from any JSON serialisation
            transform(doc, ret) {
                delete ret.passwordHash;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// email and username uniqueness is enforced at schema level (unique: true)
// Mongoose creates the indexes automatically on first use.

// ── Pre-save Hook: Hash password ──────────────────────────────────────────────
/**
 * Before saving, hash the virtual `password` field into `passwordHash`.
 * Only runs when `password` has been explicitly set on the document.
 *
 * Usage:
 *   const user = new User({ username, email });
 *   user.password = 'plainTextPassword';   ← triggers hash on save
 *   await user.save();
 */
userSchema.virtual('password').set(function (plainText) {
    this._passwordToHash = plainText;
});

// Run before validation so `passwordHash: { required: true }` passes when setting `user.password`
userSchema.pre('validate', async function () {
    if (this._passwordToHash) {
        this.passwordHash = await bcrypt.hash(this._passwordToHash, SALT_ROUNDS);
        this._passwordToHash = undefined;
    }
});

userSchema.pre('save', async function () {
    // Fallback in case validation was bypassed
    if (this._passwordToHash) {
        this.passwordHash = await bcrypt.hash(this._passwordToHash, SALT_ROUNDS);
        this._passwordToHash = undefined;
    }
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Compare a plain-text candidate password against the stored hash.
 * Must explicitly select passwordHash when querying (use .select('+passwordHash')).
 *
 * @param  {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.passwordHash) {
        throw new Error('passwordHash not selected. Use .select("+passwordHash") in your query.');
    }
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Return a safe public representation of the user (no sensitive fields).
 * @returns {object}
 */
userSchema.methods.toPublic = function () {
    return {
        _id:       this._id,
        username:  this.username,
        email:     this.email,
        role:      this.role,
        createdAt: this.createdAt,
    };
};

// ── Model ─────────────────────────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);

module.exports = User;
