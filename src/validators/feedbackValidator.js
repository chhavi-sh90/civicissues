// src/validators/feedbackValidator.js
const Joi = require('joi');

const create = Joi.object({
  complaint_id: Joi.number().integer().positive().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(500).allow('', null),
});

module.exports = { create };
