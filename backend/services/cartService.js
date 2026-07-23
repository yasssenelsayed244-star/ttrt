const Cart = require('../models/Cart');
const { MenuItem } = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const { AppError } = require('../middleware/errorHandler');

const cartService = {
  /**
   * Get or create cart for customer
   */
  async getCart(customerId) {
    const cart = await Cart.findOne({ customerId })
      .populate({
        path: 'items.menuItemId',
        select: 'name price image isAvailable restaurantId options',
      })
      .populate('restaurantId', 'name logo deliveryFee minimumOrder isOpen estimatedDeliveryTime');

    if (!cart) return { items: [], subtotal: 0, restaurantId: null };

    return this._buildCartSummary(cart);
  },

  /**
   * Add item to cart
   * Enforces single-restaurant rule
   */
  async addItem(customerId, { menuItemId, quantity, options }) {
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) throw new AppError('Menu item not found', 404);
    if (!menuItem.isAvailable) throw new AppError('This item is currently unavailable', 400);

    const restaurant = await Restaurant.findById(menuItem.restaurantId);
    if (!restaurant || restaurant.status !== 'active') {
      throw new AppError('Restaurant is not available', 400);
    }

    let cart = await Cart.findOne({ customerId });

    // If cart has items from a different restaurant, reject
    if (cart && cart.restaurantId && cart.items.length > 0) {
      if (cart.restaurantId.toString() !== menuItem.restaurantId.toString()) {
        throw new AppError(
          'Your cart contains items from another restaurant. Clear cart to add from this restaurant.',
          409
        );
      }
    }

    // Validate options
    const resolvedOptions = this._resolveOptions(menuItem, options);

    if (!cart) {
      cart = new Cart({ customerId, restaurantId: menuItem.restaurantId, items: [] });
    }

    // Check if same item+options already in cart → increment quantity
    const existingIdx = cart.items.findIndex(
      (i) =>
        i.menuItemId.toString() === menuItemId &&
        JSON.stringify(i.options) === JSON.stringify(resolvedOptions)
    );

    if (existingIdx >= 0) {
      cart.items[existingIdx].quantity += quantity;
    } else {
      cart.items.push({ menuItemId, quantity, options: resolvedOptions });
    }

    cart.restaurantId = menuItem.restaurantId;
    await cart.refreshExpiry();

    return this.getCart(customerId);
  },

  /**
   * Update item quantity
   */
  async updateItem(customerId, cartItemId, quantity) {
    const cart = await Cart.findOne({ customerId });
    if (!cart) throw new AppError('Cart not found', 404);

    const item = cart.items.id(cartItemId);
    if (!item) throw new AppError('Item not found in cart', 404);

    item.quantity = quantity;
    await cart.save();

    return this.getCart(customerId);
  },

  /**
   * Remove item from cart
   */
  async removeItem(customerId, cartItemId) {
    const cart = await Cart.findOne({ customerId });
    if (!cart) throw new AppError('Cart not found', 404);

    cart.items = cart.items.filter((i) => i._id.toString() !== cartItemId);

    // Clear restaurantId if cart is now empty
    if (cart.items.length === 0) cart.restaurantId = null;

    await cart.save();
    return this.getCart(customerId);
  },

  /**
   * Clear entire cart
   */
  async clearCart(customerId) {
    await Cart.findOneAndDelete({ customerId });
  },

  /**
   * Validate cart and calculate final pricing (pre-checkout)
   */
  async validateForCheckout(customerId) {
    const cart = await Cart.findOne({ customerId }).populate('items.menuItemId');
    if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

    const restaurant = await Restaurant.findById(cart.restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404);
    if (!restaurant.isOpen) throw new AppError('Restaurant is currently closed', 400);

    // Re-validate each item is still available and price hasn't changed
    const validatedItems = [];
    for (const cartItem of cart.items) {
      const menuItem = cartItem.menuItemId;
      if (!menuItem || !menuItem.isAvailable) {
        throw new AppError(`"${menuItem?.name || 'An item'}" is no longer available`, 400);
      }

      let itemTotal = menuItem.price;
      const resolvedOptions = [];

      for (const selected of cartItem.options) {
        const option = menuItem.options.find(
          (o) => o._id.toString() === selected.optionId?.toString()
        );
        if (!option) continue;

        const choice = option.choices.find((c) => c.name === selected.choice);
        if (!choice) continue;

        itemTotal += choice.price;
        resolvedOptions.push({
          name: option.name,
          choice: choice.name,
          extraPrice: choice.price,
        });
      }

      validatedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        quantity: cartItem.quantity,
        unitPrice: menuItem.price,
        options: resolvedOptions,
        totalPrice: +(itemTotal * cartItem.quantity).toFixed(2),
      });
    }

    const subtotal = validatedItems.reduce((sum, i) => sum + i.totalPrice, 0);

    if (subtotal < restaurant.minimumOrder) {
      throw new AppError(
        `Minimum order is ${restaurant.minimumOrder} EGP. Add ${(restaurant.minimumOrder - subtotal).toFixed(2)} EGP more.`,
        400
      );
    }

    const TAX_RATE = 0.14; // 14% VAT
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + restaurant.deliveryFee + tax).toFixed(2);

    return {
      restaurantId: restaurant._id,
      items: validatedItems,
      pricing: {
        subtotal: +subtotal.toFixed(2),
        deliveryFee: restaurant.deliveryFee,
        tax,
        discount: 0,
        total,
      },
    };
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _resolveOptions(menuItem, selectedOptions = []) {
    const resolved = [];

    for (const option of menuItem.options) {
      const selected = selectedOptions.find(
        (s) => s.optionId === option._id.toString()
      );

      if (option.required && !selected) {
        throw new AppError(`Option "${option.name}" is required`, 400);
      }

      if (selected) {
        const choice = option.choices.find((c) => c.name === selected.choice);
        if (!choice) {
          throw new AppError(`Invalid choice "${selected.choice}" for option "${option.name}"`, 400);
        }
        resolved.push({
          optionId: option._id,
          name: option.name,
          choice: choice.name,
          extraPrice: choice.price,
        });
      }
    }

    return resolved;
  },

  _buildCartSummary(cart) {
    let subtotal = 0;

    const items = cart.items.map((item) => {
      const menuItem = item.menuItemId;
      if (!menuItem) return null;

      let itemPrice = menuItem.price;
      item.options.forEach((opt) => { itemPrice += opt.extraPrice || 0; });
      const totalPrice = +(itemPrice * item.quantity).toFixed(2);
      subtotal += totalPrice;

      return {
        cartItemId: item._id,
        menuItem: {
          _id: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          image: menuItem.image,
          isAvailable: menuItem.isAvailable,
        },
        quantity: item.quantity,
        options: item.options,
        totalPrice,
      };
    }).filter(Boolean);

    const restaurant = cart.restaurantId;
    const TAX_RATE = 0.14;
    const deliveryFee = restaurant?.deliveryFee || 0;
    const tax = +(subtotal * TAX_RATE).toFixed(2);

    return {
      cartId: cart._id,
      restaurant: restaurant
        ? {
            _id: restaurant._id,
            name: restaurant.name,
            logo: restaurant.logo,
            deliveryFee: restaurant.deliveryFee,
            minimumOrder: restaurant.minimumOrder,
            estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
            isOpen: restaurant.isOpen,
          }
        : null,
      items,
      pricing: {
        subtotal: +subtotal.toFixed(2),
        deliveryFee,
        tax,
        total: +(subtotal + deliveryFee + tax).toFixed(2),
      },
      expiresAt: cart.expiresAt,
    };
  },
};

module.exports = cartService;
