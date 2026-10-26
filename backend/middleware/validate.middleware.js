/**
 * backend/middleware/validate.middleware.js
 *
 * Collects express-validator errors after validation chains run,
 * and forwards a 400 ApiError if any field failed.
 *
 * Usage — in a route file:
 *
 *   const { body } = require('express-validator');
 *   const validate = require('../middleware/validate.middleware');
 *
 *   router.post('/login',
 *       body('identifier').notEmpty().withMessage('Email or username is required.'),
 *       body('password').notEmpty().withMessage('Password is required.'),
 *       validate,             ← runs after all body() chains
 *       authController.login
 *   );
 */

'use strict';

const { validationResult } = require('express-validator');
const ApiError             = require('../utils/ApiError');

/**
 * Reads express-validator's result array.
 * If any errors exist, throws a 400 ApiError with the full details array.
 */
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const details = errors.array().map(e => ({
            field:   e.path,
            message: e.msg,
        }));
        return next(new ApiError(400, 'Validation failed.', details));
    }
    next();
}

module.exports = validate;
