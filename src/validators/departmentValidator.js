// src/validators/departmentValidator.js
const Joi = require('joi');

const create = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(255).allow('', null),
  contact_email: Joi.string().trim().lowercase().email().allow('', null),
});

const update = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(255).allow('', null),
  contact_email: Joi.string().trim().lowercase().email().allow('', null),
  is_active: Joi.boolean(),
}).min(1);

module.exports = { create, update };
