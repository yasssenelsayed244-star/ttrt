const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const result = await notificationService.getForUser(req.user._id, req.query);
  return ApiResponse.paginated(res, result.notifications, result.pagination, `${result.unreadCount} unread`);
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  return ApiResponse.success(res, null, 'All notifications marked as read');
}));

router.patch('/read', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return ApiResponse.badRequest(res, 'ids must be an array');
  await notificationService.markRead(req.user._id, ids);
  return ApiResponse.success(res, null, 'Marked as read');
}));

module.exports = router;
