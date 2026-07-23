const { uploadBuffer, deleteImage, getPublicId, UPLOAD_PRESETS } = require('../config/cloudinary');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { MenuItem } = require('../models/MenuItem');
const { AppError } = require('../middleware/errorHandler');

const uploadService = {
  async uploadAvatar(userId, fileBuffer) {
    const result = await uploadBuffer(fileBuffer, {
      ...UPLOAD_PRESETS.avatar,
      publicId: `avatar_${userId}`,
    });
    const user = await User.findById(userId).select('profile.avatar');
    if (user?.profile?.avatar) {
      const oldId = getPublicId(user.profile.avatar);
      if (oldId) await deleteImage(oldId);
    }
    await User.findByIdAndUpdate(userId, { 'profile.avatar': result.secure_url });
    return result.secure_url;
  },

  async uploadRestaurantLogo(restaurantId, ownerId, fileBuffer, isAdmin = false) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404);
    if (!isAdmin && restaurant.ownerId.toString() !== ownerId.toString()) throw new AppError('Not authorized', 403);
    const result = await uploadBuffer(fileBuffer, { ...UPLOAD_PRESETS.restaurantLogo, publicId: `logo_${restaurantId}` });
    if (restaurant.logo) await deleteImage(getPublicId(restaurant.logo));
    restaurant.logo = result.secure_url;
    await restaurant.save();
    return result.secure_url;
  },

  async uploadRestaurantCover(restaurantId, ownerId, fileBuffer, isAdmin = false) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404);
    if (!isAdmin && restaurant.ownerId.toString() !== ownerId.toString()) throw new AppError('Not authorized', 403);
    const result = await uploadBuffer(fileBuffer, { ...UPLOAD_PRESETS.restaurantCover, publicId: `cover_${restaurantId}` });
    if (restaurant.coverImage) await deleteImage(getPublicId(restaurant.coverImage));
    restaurant.coverImage = result.secure_url;
    await restaurant.save();
    return result.secure_url;
  },

  async uploadMenuItemImage(itemId, ownerId, fileBuffer, isAdmin = false) {
    const item = await MenuItem.findById(itemId);
    if (!item) throw new AppError('Menu item not found', 404);
    const restaurant = await Restaurant.findById(item.restaurantId).select('ownerId');
    if (!isAdmin && restaurant?.ownerId.toString() !== ownerId.toString()) throw new AppError('Not authorized', 403);
    const result = await uploadBuffer(fileBuffer, { ...UPLOAD_PRESETS.menuItem, publicId: `menuitem_${itemId}` });
    if (item.image) await deleteImage(getPublicId(item.image));
    item.image = result.secure_url;
    await item.save();
    const { deleteCacheByPattern } = require('../config/redis');
    await deleteCacheByPattern(`menu:${item.restaurantId}`);
    return result.secure_url;
  },
};

module.exports = uploadService;
