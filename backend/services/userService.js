const User = require('../models/User');
const SavedAddress = require('../models/SavedAddress');
const { Order, ORDER_STATUS } = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');

const MAX_ADDRESSES = 5;

const userService = {
  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new AppError('User not found', 404);
    delete user.password;
    delete user.refreshTokens;
    return user;
  },

  async updateProfile(userId, data) {
    const allowed = ['profile.firstName', 'profile.lastName', 'profile.avatar'];
    // Build flat update object to avoid overwriting nested fields
    const update = {};
    if (data.firstName) update['profile.firstName'] = data.firstName.trim();
    if (data.lastName)  update['profile.lastName']  = data.lastName.trim();
    if (data.phone) {
      // Check phone uniqueness
      const exists = await User.findOne({ phone: data.phone, _id: { $ne: userId } });
      if (exists) throw new AppError('Phone number already in use', 409);
      update.phone = data.phone;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) throw new AppError('User not found', 404);
    return user.toSafeObject();
  },

  async deleteAccount(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    // Check no active orders
    const activeOrder = await Order.findOne({
      customerId: userId,
      status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] },
    });
    if (activeOrder) throw new AppError('Cannot delete account with active orders', 400);
    await user.softDelete();
  },

  // ─── Saved Addresses ─────────────────────────────────────────────────────────

  async getAddresses(userId) {
    return SavedAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
  },

  async addAddress(userId, data) {
    const count = await SavedAddress.countDocuments({ userId });
    if (count >= MAX_ADDRESSES) {
      throw new AppError(`Maximum ${MAX_ADDRESSES} saved addresses allowed`, 400);
    }

    // If this is set as default, unset others
    if (data.isDefault) {
      await SavedAddress.updateMany({ userId }, { isDefault: false });
    }

    // First address is always default
    const isFirst = count === 0;
    const address = await SavedAddress.create({
      userId,
      ...data,
      isDefault: data.isDefault || isFirst,
    });

    return address;
  },

  async updateAddress(addressId, userId, data) {
    const address = await SavedAddress.findOne({ _id: addressId, userId });
    if (!address) throw new AppError('Address not found', 404);

    if (data.isDefault) {
      await SavedAddress.updateMany({ userId }, { isDefault: false });
    }

    Object.assign(address, data);
    await address.save();
    return address;
  },

  async deleteAddress(addressId, userId) {
    const address = await SavedAddress.findOneAndDelete({ _id: addressId, userId });
    if (!address) throw new AppError('Address not found', 404);

    // If it was default, make another one default
    if (address.isDefault) {
      const next = await SavedAddress.findOne({ userId });
      if (next) { next.isDefault = true; await next.save(); }
    }
  },

  async setDefaultAddress(addressId, userId) {
    const address = await SavedAddress.findOne({ _id: addressId, userId });
    if (!address) throw new AppError('Address not found', 404);
    await SavedAddress.updateMany({ userId }, { isDefault: false });
    address.isDefault = true;
    await address.save();
    return address;
  },

  // ─── Order History ────────────────────────────────────────────────────────────

  async getOrderHistory(userId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { customerId: userId };

    if (query.status) filter.status = query.status;
    if (query.from)   filter.createdAt = { $gte: new Date(query.from) };
    if (query.to)     filter.createdAt = { ...filter.createdAt, $lte: new Date(query.to) };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('restaurantId', 'name logo')
        .select('orderNumber status pricing.total createdAt items restaurantId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Stats
    const stats = await Order.aggregate([
      { $match: { customerId: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, '$pricing.total', 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      orders,
      pagination: buildPaginationMeta(total, page, limit),
      stats: stats[0] || { totalOrders: 0, totalSpent: 0, deliveredOrders: 0 },
    };
  },

  // ─── Favourite Restaurants ────────────────────────────────────────────────────

  async getFavourites(userId) {
    const user = await User.findById(userId)
      .select('favourites')
      .populate('favourites', 'name logo cuisine rating deliveryFee isOpen estimatedDeliveryTime')
      .lean();
    return user?.favourites || [];
  },

  async toggleFavourite(userId, restaurantId) {
    const user = await User.findById(userId).select('favourites');
    if (!user) throw new AppError('User not found', 404);

    const isFav = user.favourites?.some(id => id.toString() === restaurantId);
    if (isFav) {
      await User.findByIdAndUpdate(userId, { $pull: { favourites: restaurantId } });
      return { isFavourite: false };
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { favourites: restaurantId } });
      return { isFavourite: true };
    }
  },
};

module.exports = userService;
