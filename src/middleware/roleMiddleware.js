// src/middleware/roleMiddleware.js
// Usage: router.post('/x', authMiddleware, roleMiddleware('admin'), handler)
// or roleMiddleware('admin', 'department_official') for multiple allowed roles.

const { ApiError } = require('./errorHandler');

function roleMiddleware(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `This action requires one of the following roles: ${allowedRoles.join(', ')}.`)
      );
    }
    next();
  };
}

module.exports = roleMiddleware;
