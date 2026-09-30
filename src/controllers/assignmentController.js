// src/controllers/assignmentController.js

const complaintModel = require('../models/complaintModel');
const assignmentModel = require('../models/assignmentModel');
const userModel = require('../models/userModel');
const notificationService = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

async function validateOfficialForComplaint(official_id, complaint) {
  const official = await userModel.findById(official_id);
  if (!official || official.role !== 'department_official') {
    throw new ApiError(400, 'official_id does not refer to a department official.');
  }
  if (complaint.department_id && official.department_id !== complaint.department_id) {
    throw new ApiError(
      400,
      `This official belongs to a different department than the complaint's assigned department.`
    );
  }
  return official;
}

// POST /api/assignments  (admin, or department_official assigning within own dept)
const create = asyncHandler(async (req, res) => {
  const { complaint_id, official_id, notes } = req.body;

  const complaint = await complaintModel.findById(complaint_id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  if (req.user.role === 'department_official' && req.user.department_id !== complaint.department_id) {
    throw new ApiError(403, 'You can only assign complaints within your own department.');
  }
  if (!['admin', 'department_official'].includes(req.user.role)) {
    throw new ApiError(403, 'Only an admin or department official can assign complaints.');
  }

  const official = await validateOfficialForComplaint(official_id, complaint);

  if (!['submitted', 'under_review'].includes(complaint.status)) {
    throw new ApiError(
      400,
      `Complaint must be in 'submitted' or 'under_review' status to be assigned (currently '${complaint.status}').`
    );
  }

  const assignment = await assignmentModel.assign({
    complaint_id,
    official_id,
    assigned_by: req.user.id,
    department_id: official.department_id,
    notes,
  });

  // Move the complaint into the 'assigned' status, with a matching
  // status-history row, exactly like a manual status update would.
  const statusHistoryModel = require('../models/statusHistoryModel');
  await statusHistoryModel.addEntry({
    complaint_id,
    changed_by: req.user.id,
    old_status: complaint.status,
    new_status: 'assigned',
    remarks: notes || `Assigned to ${official.full_name}`,
  });
  const updatedComplaint = await complaintModel.updateStatus(complaint_id, { new_status: 'assigned' });

  notificationService.notifyAssignment(official_id, updatedComplaint).catch(() => {});
  notificationService.notifyStatusChange(updatedComplaint, 'assigned').catch(() => {});

  return success(res, 201, 'Complaint assigned successfully', { assignment, complaint: updatedComplaint });
});

// PUT /api/assignments/:complaintId/reassign  (admin)
const reassign = asyncHandler(async (req, res) => {
  const { official_id, notes } = req.body;
  const complaint_id = req.params.complaintId;

  const complaint = await complaintModel.findById(complaint_id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const official = await validateOfficialForComplaint(official_id, complaint);

  const assignment = await assignmentModel.assign({
    complaint_id,
    official_id,
    assigned_by: req.user.id,
    department_id: official.department_id,
    notes,
  });

  notificationService.notifyAssignment(official_id, complaint).catch(() => {});

  return success(res, 200, 'Complaint reassigned successfully', { assignment });
});

// GET /api/assignments/complaint/:complaintId
const historyForComplaint = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.complaintId);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const isOwner = req.user.role === 'citizen' && complaint.citizen_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  const isAssigned =
    req.user.role === 'department_official' &&
    (await assignmentModel.isCurrentlyAssigned(complaint.id, req.user.id));

  if (!isOwner && !isAdmin && !isAssigned) {
    throw new ApiError(403, 'You do not have permission to view this complaint\'s assignment history.');
  }

  const history = await assignmentModel.listHistory(complaint.id);
  return success(res, 200, 'Assignment history fetched', { history });
});

module.exports = { create, reassign, historyForComplaint };
