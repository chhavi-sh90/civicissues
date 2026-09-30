// src/validators/assignmentValidator.js
const Joi = require('joi');

const assign = Joi.object({
  complaint_id: Joi.number().integer().positive().required(),
  official_id: Joi.number().integer().positive().required(),
  notes: Joi.string().trim().max(255).allow('', null),
});

const reassign = Joi.object({
  official_id: Joi.number().integer().positive().required(),
  notes: Joi.string().trim().max(255).allow('', null),
});

module.exports = { assign, reassign };
