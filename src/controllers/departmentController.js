// src/controllers/departmentController.js

const departmentModel = require('../models/departmentModel');
const userModel = require('../models/userModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/departments  (any authenticated user)
const list = asyncHandler(async (req, res) => {
  const departments = await departmentModel.listAll({ onlyActive: req.user.role !== 'admin' });
  return success(res, 200, 'Departments fetched', { departments });
});

// POST /api/departments  (admin)
const create = asyncHandler(async (req, res) => {
  const existing = await departmentModel.findByName(req.body.name);
  if (existing) throw new ApiError(409, 'A department with this name already exists.');

  const department = await departmentModel.create(req.body);
  return success(res, 201, 'Department created', { department });
});

// PUT /api/departments/:id  (admin)
const update = asyncHandler(async (req, res) => {
  const existing = await departmentModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Department not found.');

  const department = await departmentModel.update(req.params.id, req.body);
  return success(res, 200, 'Department updated', { department });
});

// GET /api/departments/:id/officials  (admin)
const officials = asyncHandler(async (req, res) => {
  const department = await departmentModel.findById(req.params.id);
  if (!department) throw new ApiError(404, 'Department not found.');

  const officialsList = await userModel.findOfficialsByDepartment(req.params.id);
  return success(res, 200, 'Officials fetched', { officials: officialsList });
});

module.exports = { list, create, update, officials };
