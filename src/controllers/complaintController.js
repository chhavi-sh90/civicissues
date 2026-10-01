// src/controllers/complaintController.js

const complaintModel = require('../models/complaintModel');
const categoryModel = require('../models/categoryModel');
const imageModel = require('../models/imageModel');
const statusHistoryModel = require('../models/statusHistoryModel');
const assignmentModel = require('../models/assignmentModel'); // used for permission checks; built in Part 6
const categorizationService = require('../services/categorizationService');
const notificationService = require('../services/notificationService');
const { uploadFile } = require('../config/cloudStorage');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// Department authorities can move a complaint forward without a separate
// admin-assignment step. Legacy "assigned" complaints remain supported.
const VALID_TRANSITIONS = {
  submitted: ['under_review', 'in_progress', 'resolved', 'rejected'],
  under_review: ['in_progress', 'resolved', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [], // terminal
  rejected: [], // terminal
};

// POST /api/complaints  (citizen)
const create = asyncHandler(async (req, res) => {
  const { title, description, category_id, latitude, longitude, address } = req.body;

  const selectedCategory = await categoryModel.findById(category_id);
  if (!selectedCategory || !selectedCategory.is_active) {
    throw new ApiError(400, 'Please select an active complaint category.');
  }

  // Keep the optional categorizer hook warm for analytics/future suggestions,
  // but route the complaint from the category explicitly selected by the citizen.
  await categorizationService.suggestCategory({ title, description });
  const departmentId = selectedCategory.default_department_id;

  const imageUrls = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const url = await uploadFile(file.buffer, file.originalname, file.mimetype);
      imageUrls.push(url);
    }
  }

  const complaintId = await complaintModel.createWithDetails({
    citizen_id: req.user.id,
    title,
    description,
    category_id,
    department_id: departmentId,
    priority: selectedCategory.default_priority || 'medium',
    latitude,
    longitude,
    address,
    imageUrls,
  });

  const complaint = await complaintModel.findById(complaintId);
  return success(res, 201, 'Complaint submitted successfully', { complaint });
});

// Shared authorization check: can this user view/act on this complaint?
async function assertCanAccess(req, complaint) {
  if (req.user.role === 'admin') return;
  if (req.user.role === 'citizen' && complaint.citizen_id === req.user.id) return;
  if (req.user.role === 'department_official') {
    const isAssigned = await assignmentModel.isCurrentlyAssigned(complaint.id, req.user.id);
    const isInDepartment = complaint.department_id === req.user.department_id;
    if (isAssigned || isInDepartment) return;
  }
  throw new ApiError(403, 'You do not have permission to access this complaint.');
}

// GET /api/complaints/:id
const getOne = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  await assertCanAccess(req, complaint);

  const [images, history] = await Promise.all([
    imageModel.listByComplaint(complaint.id),
    statusHistoryModel.listByComplaint(complaint.id),
  ]);

  return success(res, 200, 'Complaint fetched', { complaint, images, history });
});

// GET /api/complaints  (scoped by role)
const list = asyncHandler(async (req, res) => {
  const { status, category_id, department_id, search, page, limit } = req.query;

  let scope = {};
  if (req.user.role === 'citizen') {
    scope = { citizen_id: req.user.id };
  } else if (req.user.role === 'department_official') {
    scope = { department_id: req.user.department_id };
  }
  // admin: scope stays {} -> sees everything, optionally filtered by department_id query param

  const result = await complaintModel.list({
    scope,
    status,
    category_id,
    department_id: req.user.role === 'admin' ? department_id : undefined,
    search,
    page,
    limit,
  });

  return success(res, 200, 'Complaints fetched', result);
});

// GET /api/complaints/my  (citizen)
const myComplaints = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await complaintModel.list({
    scope: { citizen_id: req.user.id },
    status,
    page,
    limit,
  });
  return success(res, 200, 'Your complaints fetched', result);
});

// GET /api/complaints/assigned  (department_official)
const assignedToMe = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await complaintModel.listAssignedToOfficial({
    official_id: req.user.id,
    status,
    page,
    limit,
  });
  return success(res, 200, 'Assigned complaints fetched', result);
});

// PUT /api/complaints/:id/status  (department authority or admin)
const updateStatus = asyncHandler(async (req, res) => {
  const { new_status, remarks, proof_image_url, rejection_reason } = req.body;

  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  if (req.user.role === 'department_official') {
    const isAssigned = await assignmentModel.isCurrentlyAssigned(complaint.id, req.user.id);
    const isInDepartment = complaint.department_id === req.user.department_id;
    if (!isAssigned && !isInDepartment) {
      throw new ApiError(403, 'You can only update complaints routed to your department.');
    }
  } else if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only a department authority or admin can update complaint status.');
  }

  const allowedNext = VALID_TRANSITIONS[complaint.status] || [];
  if (!allowedNext.includes(new_status)) {
    throw new ApiError(
      400,
      `Invalid status transition: cannot move from '${complaint.status}' to '${new_status}'.`
    );
  }

  await statusHistoryModel.addEntry({
    complaint_id: complaint.id,
    changed_by: req.user.id,
    old_status: complaint.status,
    new_status,
    remarks,
    proof_image_url,
  });

  if (new_status === 'rejected' && rejection_reason) {
    const { pool } = require('../config/db');
    await pool.execute(`UPDATE complaints SET rejection_reason = ? WHERE id = ?`, [
      rejection_reason,
      complaint.id,
    ]);
  }

  const resolved_at = new_status === 'resolved' ? new Date() : undefined;
  const updated = await complaintModel.updateStatus(complaint.id, { new_status, resolved_at });

  // Notify the citizen — best-effort; failures are logged, never thrown
  // back to the caller (a notification failure shouldn't fail the
  // status update itself).
  notificationService.notifyStatusChange(updated, new_status, remarks).catch(() => {});

  return success(res, 200, 'Complaint status updated', { complaint: updated });
});

// GET /api/complaints/:id/history
const getHistory = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  await assertCanAccess(req, complaint);

  const history = await statusHistoryModel.listByComplaint(complaint.id);
  return success(res, 200, 'Status history fetched', { history });
});

module.exports = { create, getOne, list, myComplaints, assignedToMe, updateStatus, getHistory };
