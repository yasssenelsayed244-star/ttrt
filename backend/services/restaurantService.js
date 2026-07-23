const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const { MenuItem, MenuCategory } = require('../models/MenuItem');
const { AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache, deleteCacheByPattern } = require('../config/redis');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');

const CACHE_TTL = 300; // 5 minutes

const restaurantService = {
  // ─── Restaurant CRUD ────────────────────────────────────────────────────────

  async create(ownerId, data) {
    const restaurant = await Restaurant.create({ ownerId, ...data });
    await deleteCacheByPattern('restaurants:*');
    return restaurant;
  },

  async getAll(query) {
    const cacheKey = `restaurants:list:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter = { status: 'active' };

    if (query.city) filter['address.city'] = new RegExp(query.city, 'i');
    if (query.cuisine) filter.cuisine = { $in: [query.cuisine.toLowerCase()] };
    if (query.isOpen !== undefined) filter.isOpen = query.isOpen;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { description: new RegExp(query.search, 'i') },
        { cuisine: { $in: [new RegExp(query.search, 'i')] } },
      ];
    }

    // Geo-based query
    if (query.lat && query.lng) {
      filter.location = {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [query.lng, query.lat] },
          $maxDistance: (query.radius || 10) * 1000, // convert km to meters
        },
      };
    }

    const sortOptions = {
      rating: { 'rating.average': -1 },
      deliveryFee: { deliveryFee: 1 },
      deliveryTime: { estimatedDeliveryTime: 1 },
      distance: {}, // already sorted by $nearSphere
    };
    const sort = sortOptions[query.sortBy] || { 'rating.average': -1 };

    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter)
        .select('-menuCategories')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Restaurant.countDocuments(filter),
    ]);

    const result = {
      restaurants,
      pagination: buildPaginationMeta(total, page, limit),
    };

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  },

  async getById(id) {
    const cacheKey = `restaurants:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const restaurant = await Restaurant.findById(id)
      .populate('menuCategories', 'name description sortOrder isActive')
      .lean();

    if (!restaurant) throw new AppError('Restaurant not found', 404);

    await setCache(cacheKey, restaurant, CACHE_TTL);
    return restaurant;
  },

  async getByOwner(ownerId) {
    return Restaurant.find({ ownerId }).lean();
  },

  async update(id, ownerId, data, isAdmin = false) {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    if (!isAdmin && restaurant.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized to update this restaurant', 403);
    }

    Object.assign(restaurant, data);
    await restaurant.save();

    await deleteCache(`restaurants:${id}`);
    await deleteCacheByPattern('restaurants:list:*');

    return restaurant;
  },

  async delete(id, ownerId, isAdmin = false) {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    if (!isAdmin && restaurant.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized', 403);
    }

    restaurant.status = 'inactive';
    await restaurant.save();

    await deleteCache(`restaurants:${id}`);
    await deleteCacheByPattern('restaurants:list:*');
  },

  async toggleOpen(restaurantId, ownerId) {
    const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();
    await deleteCache(`restaurants:${restaurantId}`);

    return restaurant;
  },

  async approve(restaurantId, status, reason) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    restaurant.status = status; // 'approved' or 'rejected'
    if (status === 'rejected' && reason) restaurant.rejectionReason = reason;
    if (status === 'approved') restaurant.status = 'active';
    await restaurant.save();

    await deleteCacheByPattern('restaurants:*');
    return restaurant;
  },

  // ─── Menu Categories ────────────────────────────────────────────────────────

  async getMenu(restaurantId) {
    const cacheKey = `menu:${restaurantId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const [categories, items] = await Promise.all([
      MenuCategory.find({ restaurantId, isActive: true })
        .sort({ sortOrder: 1 })
        .lean(),
      MenuItem.find({ restaurantId, isAvailable: true })
        .sort({ sortOrder: 1 })
        .lean(),
    ]);

    // Group items under their category
    const menu = categories.map((cat) => ({
      ...cat,
      items: items.filter((item) => item.categoryId.toString() === cat._id.toString()),
    }));

    await setCache(cacheKey, menu, CACHE_TTL);
    return menu;
  },

  async createCategory(restaurantId, ownerId, data, isAdmin = false) {
    await this._assertOwner(restaurantId, ownerId, isAdmin);
    const category = await MenuCategory.create({ restaurantId, ...data });
    await deleteCache(`menu:${restaurantId}`);
    return category;
  },

  async updateCategory(categoryId, ownerId, data, isAdmin = false) {
    const category = await MenuCategory.findById(categoryId).populate('restaurantId');
    if (!category) throw new AppError('Category not found', 404);

    if (!isAdmin && category.restaurantId.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized', 403);
    }

    Object.assign(category, data);
    await category.save();
    await deleteCache(`menu:${category.restaurantId._id}`);
    return category;
  },

  async deleteCategory(categoryId, ownerId, isAdmin = false) {
    const category = await MenuCategory.findById(categoryId).populate('restaurantId');
    if (!category) throw new AppError('Category not found', 404);

    if (!isAdmin && category.restaurantId.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized', 403);
    }

    // Check no items exist in this category
    const itemCount = await MenuItem.countDocuments({ categoryId });
    if (itemCount > 0) {
      throw new AppError(`Cannot delete: ${itemCount} items exist in this category`, 400);
    }

    await category.deleteOne();
    await deleteCache(`menu:${category.restaurantId._id}`);
  },

  // ─── Menu Items ─────────────────────────────────────────────────────────────

  async createMenuItem(ownerId, data, isAdmin = false) {
    await this._assertOwner(data.restaurantId, ownerId, isAdmin);

    // Verify category belongs to restaurant
    const category = await MenuCategory.findOne({
      _id: data.categoryId,
      restaurantId: data.restaurantId,
    });
    if (!category) throw new AppError('Category not found in this restaurant', 404);

    const item = await MenuItem.create(data);
    await deleteCache(`menu:${data.restaurantId}`);
    return item;
  },

  async updateMenuItem(itemId, ownerId, data, isAdmin = false) {
    const item = await MenuItem.findById(itemId);
    if (!item) throw new AppError('Menu item not found', 404);

    await this._assertOwner(item.restaurantId, ownerId, isAdmin);

    Object.assign(item, data);
    await item.save();
    await deleteCache(`menu:${item.restaurantId}`);
    return item;
  },

  async toggleAvailability(itemId, ownerId, isAdmin = false) {
    const item = await MenuItem.findById(itemId);
    if (!item) throw new AppError('Menu item not found', 404);

    await this._assertOwner(item.restaurantId, ownerId, isAdmin);

    item.isAvailable = !item.isAvailable;
    await item.save();
    await deleteCache(`menu:${item.restaurantId}`);
    return item;
  },

  async deleteMenuItem(itemId, ownerId, isAdmin = false) {
    const item = await MenuItem.findById(itemId);
    if (!item) throw new AppError('Menu item not found', 404);

    await this._assertOwner(item.restaurantId, ownerId, isAdmin);

    await item.deleteOne();
    await deleteCache(`menu:${item.restaurantId}`);
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async _assertOwner(restaurantId, ownerId, isAdmin) {
    if (isAdmin) return;
    const restaurant = await Restaurant.findById(restaurantId).select('ownerId');
    if (!restaurant) throw new AppError('Restaurant not found', 404);
    if (restaurant.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Not authorized', 403);
    }
  },
};

module.exports = restaurantService;
