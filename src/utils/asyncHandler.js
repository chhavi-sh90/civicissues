// src/utils/asyncHandler.js
// Wraps an async Express route handler so any thrown/rejected error is
// passed to next(err) automatically, instead of needing try/catch in
// every single controller function.

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
