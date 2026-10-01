// src/controllers/userController.js

const bcrypt = require('bcrypt');
const env = require('../config/env');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/users/profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  return success(res, 200, 'Profile fetched', { user });
});

// PUT /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await userModel.updateProfile(req.user.id, req.body);
  return success(res, 200, 'Profile updated', { user });
});

// PUT /api/users/profile/password
const updatePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  const userWithHash = await userModel.findByEmailWithPassword(req.user.email);
  const matches = await bcrypt.compare(current_password, userWithHash.password_hash);
  if (!matches) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  const newHash = await bcrypt.hash(new_password, env.BCRYPT_SALT_ROUNDS);
  await userModel.updatePasswordHash(req.user.id, newHash);

  return success(res, 200, 'Password updated successfully');
});

// GET /api/users (admins see all; officials see their department's user scope)
const listUsers = asyncHandler(async (req, res) => {
  const { role, department_id, page, limit } = req.query;
  const result = await userModel.list({
    role,
    department_id,
    scope_department_id: req.user.role === 'department_official' ? req.user.department_id : undefined,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  return success(res, 200, 'Users fetched', result);
});

// PUT /api/users/:id/status  (admin)
const setUserStatus = asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const target = await userModel.findById(req.params.id);
  if (!target) throw new ApiError(404, 'User not found.');

  const user = await userModel.setActiveStatus(req.params.id, Boolean(is_active));
  return success(res, 200, 'User status updated', { user });
});

// PUT /api/users/profile/fcm-token
const updateFcmToken = asyncHandler(async (req, res) => {
  await userModel.updateFcmToken(req.user.id, req.body.fcm_token);
  return success(res, 200, 'Device token registered for push notifications');
});

module.exports = { getProfile, updateProfile, updatePassword, updateFcmToken, listUsers, setUserStatus };
