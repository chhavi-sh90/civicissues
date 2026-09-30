// src/middleware/validateMiddleware.js
// Usage: router.post('/x', validate(someJoiSchema), handler)
// Validates req.body by default; pass { source: 'query' } to validate
// query params instead (used by list/filter endpoints).

function validate(schema, options = {}) {
  const source = options.source || 'body';

  return function (req, res, next) {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      error.statusCode = 400;
      return next(error); // errorHandler.js has a dedicated branch for err.isJoi
    }

    req[source] = value;
    next();
  };
}

module.exports = validate;
