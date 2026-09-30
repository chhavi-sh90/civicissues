// src/controllers/notificationController.js

const notificationModel = require('../models/notificationModel');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');

// GET /api/notifications
const list = asyncHandler(async (req, res) => {
  const { is_read, page, limit } = req.query;
  const result = await notificationModel.listByUser({
    user_id: req.user.id,
    is_read: is_read !== undefined ? is_read === 'true' : undefined,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  return success(res, 200, 'Notifications fetched', result);
});

// PUT /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  await notificationModel.markRead(req.params.id, req.user.id);
  return success(res, 200, 'Notification marked as read');
});

// PUT /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await notificationModel.markAllRead(req.user.id);
  return success(res, 200, 'All notifications marked as read');
});

module.exports = { list, markRead, markAllRead };
