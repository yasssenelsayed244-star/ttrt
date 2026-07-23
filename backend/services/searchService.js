const Restaurant = require('../models/Restaurant');
const { MenuItem } = require('../models/MenuItem');
const { setCache, getCache } = require('../config/redis');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');

const CACHE_TTL = 120; // 2 min for search results

const searchService = {
  /**
   * Global search — restaurants + menu items
   */
  async globalSearch(query, userCoords) {
    const { q, page, limit } = query;
    if (!q || q.trim().length < 2) return { restaurants: [], menuItems: [], total: 0 };

    const cacheKey = `search:${q.toLowerCase().trim()}:${page}:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const regex = new RegExp(q.trim(), 'i');
    const { skip } = getPagination(page, limit);

    const [restaurants, menuItems] = await Promise.all([
      Restaurant.find({
        status: 'active',
        $or: [
          { name: regex },
          { description: regex },
          { cuisine: { $in: [regex] } },
        ],
      })
        .select('name logo cuisine rating deliveryFee isOpen estimatedDeliveryTime address.city')
        .limit(10)
        .lean(),

      MenuItem.find({
        isAvailable: true,
        $or: [
          { name: regex },
          { description: regex },
          { tags: { $in: [regex] } },
        ],
      })
        .populate('restaurantId', 'name logo isOpen')
        .select('name price image description restaurantId')
        .limit(10)
        .lean(),
    ]);

    const result = { restaurants, menuItems, total: restaurants.length + menuItems.length };
    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  },

  /**
   * Advanced restaurant filter + sort
   */
  async filterRestaurants(query) {
    const {
      page, limit,
      cuisine, city, minRating, maxDeliveryFee,
      maxDeliveryTime, isOpen, sortBy,
      lat, lng, radius,
      priceRange, // 'budget'|'mid'|'premium'
      search,
    } = query;

    const cacheKey = `restaurants:filter:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { skip } = getPagination(page, limit);
    const parsedLimit = Math.min(50, parseInt(limit) || 20);
    const parsedPage  = Math.max(1, parseInt(page) || 1);

    const filter = { status: 'active' };

    if (isOpen !== undefined) filter.isOpen = isOpen === 'true';
    if (city)    filter['address.city'] = new RegExp(city, 'i');
    if (cuisine) filter.cuisine = { $in: [cuisine.toLowerCase()] };
    if (minRating)     filter['rating.average']       = { $gte: parseFloat(minRating) };
    if (maxDeliveryFee) filter.deliveryFee            = { $lte: parseFloat(maxDeliveryFee) };
    if (maxDeliveryTime) filter.estimatedDeliveryTime = { $lte: parseInt(maxDeliveryTime) };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { description: regex }, { cuisine: { $in: [regex] } }];
    }

    // Price range filter via minimumOrder proxy
    if (priceRange) {
      const ranges = { budget: [0, 60], mid: [60, 150], premium: [150, 99999] };
      const [min, max] = ranges[priceRange] || [0, 99999];
      filter.minimumOrder = { $gte: min, $lte: max };
    }

    // Geo query overrides other sorts
    if (lat && lng) {
      filter.location = {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius || 10) * 1000,
        },
      };
    }

    const sortOptions = {
      rating:       { 'rating.average': -1 },
      deliveryFee:  { deliveryFee: 1 },
      deliveryTime: { estimatedDeliveryTime: 1 },
      newest:       { createdAt: -1 },
    };
    const sort = (lat && lng) ? {} : (sortOptions[sortBy] || { 'rating.average': -1 });

    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter)
        .select('-menuCategories')
        .sort(sort)
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      Restaurant.countDocuments(filter),
    ]);

    const result = {
      restaurants,
      pagination: buildPaginationMeta(total, parsedPage, parsedLimit),
      filters: { cuisine, city, minRating, maxDeliveryFee, maxDeliveryTime, isOpen, priceRange },
    };

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  },

  /**
   * Autocomplete suggestions — fast prefix search for the search bar
   */
  async autocomplete(q) {
    if (!q || q.length < 2) return [];

    const cacheKey = `autocomplete:${q.toLowerCase()}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const regex = new RegExp(`^${q.trim()}`, 'i');

    const [restaurants, items] = await Promise.all([
      Restaurant.find({ status: 'active', name: regex })
        .select('name logo cuisine')
        .limit(4)
        .lean(),
      MenuItem.find({ isAvailable: true, name: regex })
        .select('name price restaurantId')
        .populate('restaurantId', 'name')
        .limit(4)
        .lean(),
    ]);

    const suggestions = [
      ...restaurants.map(r => ({ type: 'restaurant', id: r._id, text: r.name, meta: r.cuisine.join(', '), image: r.logo })),
      ...items.map(i => ({ type: 'item', id: i._id, text: i.name, meta: i.restaurantId?.name, price: i.price })),
    ];

    await setCache(cacheKey, suggestions, 60);
    return suggestions;
  },

  /**
   * Popular / trending searches (based on order frequency)
   */
  async getTrending() {
    const cacheKey = 'trending:cuisines';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { Order, ORDER_STATUS } = require('../models/Order');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await Order.aggregate([
      { $match: { status: ORDER_STATUS.DELIVERED, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$restaurantId', orderCount: { $sum: 1 } } },
      { $sort: { orderCount: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: '$restaurant' },
      {
        $project: {
          name: '$restaurant.name',
          logo: '$restaurant.logo',
          cuisine: '$restaurant.cuisine',
          rating: '$restaurant.rating',
          deliveryFee: '$restaurant.deliveryFee',
          orderCount: 1,
        },
      },
    ]);

    await setCache(cacheKey, trending, 300);
    return trending;
  },
};

module.exports = searchService;
