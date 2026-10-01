// src/controllers/analyticsController.js

const analyticsService = require('../services/analyticsService');
const complaintModel = require('../models/complaintModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

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

// GET /api/analytics/by-department
const byDepartment = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getByDepartment({ from, to, department_id });
  return success(res, 200, 'Complaints by department fetched', { departments: data });
});

// GET /api/analytics/resolution-time
const resolutionTime = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getResolutionTime({ from, to, department_id });
  return success(res, 200, 'Resolution time fetched', data);
});

// GET /api/analytics/trends
const trends = asyncHandler(async (req, res) => {
  const { from, to, group_by } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getTrends({ from, to, group_by, department_id });
  return success(res, 200, 'Trends fetched', { trends: data });
});

// GET /api/analytics/hotspots
const hotspots = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const department_id = resolveDepartmentScope(req);
  const data = await analyticsService.getHotspots({ from, to, department_id });
  return success(res, 200, 'Hotspots fetched', { hotspots: data });
});

// GET /api/analytics/ai-analysis/:complaintId
const aiAnalysis = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.complaintId);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  if (
    req.user.role === 'department_official' &&
    complaint.department_id !== req.user.department_id
  ) {
    throw new ApiError(403, 'You can only analyze complaints routed to your department.');
  }

  const analysis = await analyticsService.analyzeComplaint(complaint.id);
  return success(res, 200, 'AI-assisted complaint analysis completed', { analysis });
});

module.exports = { summary, byCategory, byDepartment, resolutionTime, trends, hotspots, aiAnalysis };
