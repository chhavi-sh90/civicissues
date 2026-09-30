// src/controllers/feedbackController.js

const complaintModel = require('../models/complaintModel');
const feedbackModel = require('../models/feedbackModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/feedback  (citizen, only on their own resolved complaint)
const create = asyncHandler(async (req, res) => {
  const { complaint_id, rating, comment } = req.body;

  const complaint = await complaintModel.findById(complaint_id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  if (complaint.citizen_id !== req.user.id) {
    throw new ApiError(403, 'You can only leave feedback on your own complaints.');
  }
  if (complaint.status !== 'resolved') {
    throw new ApiError(400, 'Feedback can only be submitted for resolved complaints.');
  }

  const existing = await feedbackModel.findByComplaint(complaint_id);
  if (existing) {
    throw new ApiError(409, 'Feedback has already been submitted for this complaint.');
  }

  const feedback = await feedbackModel.create({ complaint_id, citizen_id: req.user.id, rating, comment });
  return success(res, 201, 'Feedback submitted', { feedback });
});

// GET /api/feedback/complaint/:complaintId
const getForComplaint = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.complaintId);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const assignmentModel = require('../models/assignmentModel');
  const isOwner = req.user.role === 'citizen' && complaint.citizen_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  const isAssigned =
    req.user.role === 'department_official' &&
    (await assignmentModel.isCurrentlyAssigned(complaint.id, req.user.id));

  if (!isOwner && !isAdmin && !isAssigned) {
    throw new ApiError(403, 'You do not have permission to view this feedback.');
  }

  const feedback = await feedbackModel.findByComplaint(complaint.id);
  if (!feedback) throw new ApiError(404, 'No feedback submitted for this complaint yet.');

  return success(res, 200, 'Feedback fetched', { feedback });
});

module.exports = { create, getForComplaint };
