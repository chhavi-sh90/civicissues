// src/validators/complaintValidator.js
const Joi = require('joi');

// Note: for multipart/form-data requests, numeric/boolean fields arrive
// as strings — Joi's .number() etc. still coerce these correctly by default.

const create = Joi.object({
  title: Joi.string().trim().min(5).max(150).required(),
  description: Joi.string().trim().min(10).max(3000).required(),
  category_id: Joi.number().integer().positive().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().trim().max(255).allow('', null),
});

const updateStatus = Joi.object({
  new_status: Joi.string()
    .valid('under_review', 'assigned', 'in_progress', 'resolved', 'rejected')
    .required(),
  remarks: Joi.string().trim().max(500).allow('', null),
  proof_image_url: Joi.string().trim().uri({ relativeOnly: true }).allow('', null),
  rejection_reason: Joi.string().trim().max(255).when('new_status', {
    is: 'rejected',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const listQuery = Joi.object({
  status: Joi.string().valid(
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
    'rejected'
  ),
  category_id: Joi.number().integer().positive(),
  department_id: Joi.number().integer().positive(),
  search: Joi.string().trim().max(150).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { create, updateStatus, listQuery };
