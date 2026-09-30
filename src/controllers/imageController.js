// src/controllers/imageController.js

const complaintModel = require('../models/complaintModel');
const imageModel = require('../models/imageModel');
const assignmentModel = require('../models/assignmentModel');
const { uploadFile } = require('../config/cloudStorage');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/complaints/:id/images
// Citizen adds more submission photos; assigned official adds resolution proof.
const addImage = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  if (!req.file) throw new ApiError(400, 'No image file provided (field name must be "image").');

  let image_type = 'submission';

  if (req.user.role === 'citizen') {
    if (complaint.citizen_id !== req.user.id) {
      throw new ApiError(403, 'You can only add photos to your own complaints.');
    }
    image_type = 'submission';
  } else if (req.user.role === 'department_official') {
    const isAssigned = await assignmentModel.isCurrentlyAssigned(complaint.id, req.user.id);
    if (!isAssigned) {
      throw new ApiError(403, 'You can only add resolution proof to complaints assigned to you.');
    }
    image_type = 'resolution_proof';
  } else if (req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have permission to add images to this complaint.');
  }

  const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const image = await imageModel.addImage({
    complaint_id: complaint.id,
    image_url: url,
    image_type,
    uploaded_by: req.user.id,
  });

  return success(res, 201, 'Image uploaded', { image });
});

// DELETE /api/complaints/:id/images/:imageId
const deleteImage = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found.');

  const image = await imageModel.findById(req.params.imageId);
  if (!image || image.complaint_id !== complaint.id) {
    throw new ApiError(404, 'Image not found on this complaint.');
  }

  const isOwner = req.user.role === 'citizen' && complaint.citizen_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Only the complaint owner or an admin can delete this image.');
  }

  await imageModel.remove(image.id);
  return success(res, 200, 'Image deleted');
});

module.exports = { addImage, deleteImage };
