const PromoCode = require('../models/PromoCode');
const { AppError } = require('../middleware/errorHandler');

const promoService = {
  async validate(code, customerId, subtotal, restaurantId) {
    const promo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (!promo) throw new AppError('Invalid promo code', 404);
    if (!promo.isValid) throw new AppError('Promo code is expired or inactive', 400);
    if (subtotal < promo.minOrderAmount) {
      throw new AppError(`Minimum order of ${promo.minOrderAmount} EGP required`, 400);
    }
    if (promo.applicableRestaurants.length > 0) {
      const applies = promo.applicableRestaurants.some(id => id.toString() === restaurantId.toString());
      if (!applies) throw new AppError('Promo code not valid for this restaurant', 400);
    }
    const userUseCount = promo.usedBy.filter(id => id.toString() === customerId.toString()).length;
    if (userUseCount >= promo.maxUsesPerUser) {
      throw new AppError('You have already used this promo code', 400);
    }
    const discount = +promo.calculateDiscount(subtotal).toFixed(2);
    return { promoId: promo._id, code: promo.code, type: promo.type, value: promo.value, discount, description: promo.description };
  },

  async apply(promoId, customerId) {
    await PromoCode.findByIdAndUpdate(promoId, {
      $inc: { usedCount: 1 },
      $push: { usedBy: customerId },
    });
  },

  async create(adminId, data) {
    const existing = await PromoCode.findOne({ code: data.code.toUpperCase() });
    if (existing) throw new AppError('Promo code already exists', 409);
    return PromoCode.create({ ...data, code: data.code.toUpperCase(), createdBy: adminId });
  },

  async list(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    return PromoCode.find(filter).sort({ createdAt: -1 }).lean();
  },

  async deactivate(codeId) {
    const promo = await PromoCode.findByIdAndUpdate(codeId, { isActive: false }, { new: true });
    if (!promo) throw new AppError('Promo code not found', 404);
    return promo;
  },
};

module.exports = promoService;
