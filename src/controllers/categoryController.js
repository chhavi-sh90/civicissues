// src/controllers/categoryController.js

const categoryModel = require('../models/categoryModel');
const departmentModel = require('../models/departmentModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/categories  (any authenticated user)
const list = asyncHandler(async (req, res) => {
  const categories = await categoryModel.listAll({ onlyActive: req.user.role !== 'admin' });
  return success(res, 200, 'Categories fetched', { categories });
});

// POST /api/categories  (admin)
const create = asyncHandler(async (req, res) => {
  const existing = await categoryModel.findBySlug(req.body.slug);
  if (existing) throw new ApiError(409, 'A category with this slug already exists.');

  const department = await departmentModel.findById(req.body.default_department_id);
  if (!department) throw new ApiError(400, 'default_department_id does not refer to a real department.');

  const category = await categoryModel.create(req.body);
  return success(res, 201, 'Category created', { category });
});

// PUT /api/categories/:id  (admin)
const update = asyncHandler(async (req, res) => {
  const existing = await categoryModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Category not found.');

  if (req.body.default_department_id) {
    const department = await departmentModel.findById(req.body.default_department_id);
    if (!department) throw new ApiError(400, 'default_department_id does not refer to a real department.');
  }

  const category = await categoryModel.update(req.params.id, req.body);
  return success(res, 200, 'Category updated', { category });
});

// DELETE /api/categories/:id  (admin) — soft delete
const remove = asyncHandler(async (req, res) => {
  const existing = await categoryModel.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Category not found.');

  const category = await categoryModel.update(req.params.id, { is_active: false });
  return success(res, 200, 'Category deactivated', { category });
});

module.exports = { list, create, update, remove };
