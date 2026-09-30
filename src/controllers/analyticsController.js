// src/controllers/analyticsController.js

const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');

// Officials only ever see their own department's numbers; admins can see
// everything, or narrow with ?department_id= if they want.
function resolveDepartmentScope(req) {
  if (req.user.role === 'department_official') return req.user.department_id;
  return req.query.department_id;
}

// GET /api/analytics/summary
const summary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getSummary({ from, to, department_id });
  return success(res, 200, 'Summary fetched', data);
});

// GET /api/analytics/by-category
const byCategory = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getByCategory({ from, to, department_id });
  return success(res, 200, 'Complaints by category fetched', { categories: data });
});

// GET /api/analytics/by-department  (admin only, enforced at route level)
const byDepartment = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await analyticsService.getByDepartment({ from, to });
  return success(res, 200, 'Complaints by department fetched', { departments: data });
});

// GET /api/analytics/resolution-time
const resolutionTime = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getResolutionTime({ from, to, department_id });
  return success(res, 200, 'Resolution time fetched', data);
});

// GET /api/analytics/trends  (admin only, enforced at route level)
const trends = asyncHandler(async (req, res) => {
  const { from, to, group_by } = req.query;
  const data = await analyticsService.getTrends({ from, to, group_by });
  return success(res, 200, 'Trends fetched', { trends: data });
});

// GET /api/analytics/hotspots  (admin only, enforced at route level)
const hotspots = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await analyticsService.getHotspots({ from, to });
  return success(res, 200, 'Hotspots fetched', { hotspots: data });
});

module.exports = { summary, byCategory, byDepartment, resolutionTime, trends, hotspots };
