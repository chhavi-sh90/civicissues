// src/validators/authValidator.js
const Joi = require('joi');

const passwordRule = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter and one number.',
    'string.min': 'Password must be at least 8 characters long.',
  });

const register = Joi.object({
  full_name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().lowercase().email().required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s]{7,20}$/)
    .allow('', null),
  password: passwordRule.required(),
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

const updateProfile = Joi.object({
  full_name: Joi.string().trim().min(2).max(120),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s]{7,20}$/)
    .allow('', null),
}).min(1);

const updatePassword = Joi.object({
  current_password: Joi.string().required(),
  new_password: passwordRule.required(),
});

// Admin-only: creating officials/admins with an explicit role
const createUserByAdmin = Joi.object({
  full_name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().lowercase().email().required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s]{7,20}$/)
    .allow('', null),
  password: passwordRule.required(),
  role: Joi.string().valid('citizen', 'department_official', 'admin').required(),
  department_id: Joi.number().integer().positive().when('role', {
    is: 'department_official',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const setUserStatus = Joi.object({
  is_active: Joi.boolean().required(),
});

const updateFcmToken = Joi.object({
  fcm_token: Joi.string().trim().min(10).max(255).required(),
});

module.exports = {
  register,
  login,
  updateProfile,
  updatePassword,
  createUserByAdmin,
  setUserStatus,
  updateFcmToken,
};
