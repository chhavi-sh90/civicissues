// src/utils/apiResponse.js
// Ensures every controller returns the same JSON shape, matching
// API_CONTRACT.md's documented envelope.

function success(res, statusCode, message, data = null) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
}

function error(res, statusCode, message, errors = null) {
  const body = { success: false, message };
  if (errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
