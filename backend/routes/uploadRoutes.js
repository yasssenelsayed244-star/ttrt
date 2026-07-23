const express = require('express');
const router = express.Router();
const uploadService = require('../services/uploadService');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { handleUpload } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

router.post('/avatar', handleUpload('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);
  const url = await uploadService.uploadAvatar(req.user._id, req.file.buffer);
  return ApiResponse.success(res, { url }, 'Avatar updated');
}));

router.post('/restaurant/:id/logo', authorize('restaurant_owner', 'admin'), handleUpload('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);
  const url = await uploadService.uploadRestaurantLogo(req.params.id, req.user._id, req.file.buffer, req.user.role === 'admin');
  return ApiResponse.success(res, { url }, 'Logo updated');
}));

router.post('/restaurant/:id/cover', authorize('restaurant_owner', 'admin'), handleUpload('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);
  const url = await uploadService.uploadRestaurantCover(req.params.id, req.user._id, req.file.buffer, req.user.role === 'admin');
  return ApiResponse.success(res, { url }, 'Cover image updated');
}));

router.post('/menu-item/:id', authorize('restaurant_owner', 'admin'), handleUpload('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file provided', 400);
  const url = await uploadService.uploadMenuItemImage(req.params.id, req.user._id, req.file.buffer, req.user.role === 'admin');
  return ApiResponse.success(res, { url }, 'Item image updated');
}));

module.exports = router;
