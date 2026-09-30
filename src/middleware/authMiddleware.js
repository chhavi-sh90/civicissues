// src/middleware/authMiddleware.js
// Verifies the JWT from the Authorization header and attaches the
// decoded payload to req.user for downstream middleware/controllers.

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('./errorHandler');
const userModel = require('../models/userModel');

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Missing or malformed Authorization header. Expected: Bearer <token>.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Re-check the user still exists and is active on every request.
    // This ensures a deactivated account's existing token stops working
    // immediately, instead of only at token expiry.
    const user = await userModel.findById(decoded.id);
    if (!user || !user.is_active) {
      throw new ApiError(401, 'This account is no longer active.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
