// src/controllers/authController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// POST /api/auth/register  (public, always creates a "citizen")
const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const user = await userModel.create({ full_name, email, phone, password_hash, role: 'citizen' });
  const token = issueToken(user);

  return success(res, 201, 'Registration successful', { user, token });
});

// POST /api/auth/login  (public)
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const userWithHash = await userModel.findByEmailWithPassword(email);
  if (!userWithHash) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!userWithHash.is_active) {
    throw new ApiError(401, 'This account has been deactivated. Contact an administrator.');
  }

  const passwordMatches = await bcrypt.compare(password, userWithHash.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = await userModel.findById(userWithHash.id); // strips password_hash
  const token = issueToken(user);

  return success(res, 200, 'Login successful', { user, token });
});

// GET /api/auth/me  (any authenticated user)
const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  return success(res, 200, 'Current user profile', { user });
});

// POST /api/users  (admin only — creates officials/admins/citizens with explicit role)
const createUserByAdmin = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role, department_id } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const user = await userModel.create({
    full_name,
    email,
    phone,
    password_hash,
    role,
    department_id,
  });

  return success(res, 201, `${role} account created successfully`, { user });
});

module.exports = { register, login, me, createUserByAdmin };
