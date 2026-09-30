// src/validators/analyticsValidator.js
const Joi = require('joi');

const dateRangeQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  department_id: Joi.number().integer().positive(),
});

const trendsQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  group_by: Joi.string().valid('day', 'week', 'month').default('day'),
});

module.exports = { dateRangeQuery, trendsQuery };
