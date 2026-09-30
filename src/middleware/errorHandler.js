// src/middleware/errorHandler.js
// Centralized error handler — the LAST middleware registered in app.js.
// Every controller either throws, or calls next(err), and it lands here.

const logger = require('../utils/logger');
const { error } = require('../utils/apiResponse');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} -> ${err.message}`);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    logger.debug(err.stack);
  }

  // Joi validation errors
  if (err.isJoi) {
    return error(
      res,
      400,
      'Validation failed',
      err.details.map((d) => d.message)
    );
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return error(res, 409, 'A record with this value already exists.');
  }

  // MySQL foreign key constraint
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return error(res, 400, 'Invalid reference to a related record.');
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    return error(res, 422, `File upload error: ${err.message}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 401, 'Invalid authentication token.');
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, 401, 'Authentication token has expired.');
  }

  // Explicit application errors (thrown with { statusCode, message })
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return error(res, statusCode, message);
}

// Helper for controllers/services to throw HTTP-aware errors.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, ApiError };
