// src/validators/categoryValidator.js
const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .required()
    .messages({ 'string.pattern.base': 'Slug must be lowercase, hyphen-separated (e.g. "water-supply").' }),
  default_department_id: Joi.number().integer().positive().required(),
  default_priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
});

const update = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  default_department_id: Joi.number().integer().positive(),
  default_priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  is_active: Joi.boolean(),
}).min(1);

module.exports = { create, update };
