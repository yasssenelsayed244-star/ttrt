process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const {
  connectTestDB, clearTestDB, closeTestDB,
  createUser, createRestaurant, createCategory, createMenuItem,
} = require('../helpers');
const cartService = require('../../src/services/cartService');
const Cart = require('../../src/models/Cart');

beforeAll(() => connectTestDB());
afterEach(() => clearTestDB());
afterAll(() => closeTestDB());

describe('CartService', () => {
  let customer, restaurant, category, item1, item2;

  beforeEach(async () => {
    customer   = await createUser({ email: 'cart@test.com' });
    restaurant = await createRestaurant(customer._id);
    category   = await createCategory(restaurant._id);
    item1      = await createMenuItem(restaurant._id, category._id, { name: 'Pizza', price: 100 });
    item2      = await createMenuItem(restaurant._id, category._id, { name: 'Burger', price: 80 });
  });

  describe('addItem()', () => {
    it('adds an item to an empty cart', async () => {
      const cart = await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 2, options: [] });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
    });

    it('increments quantity if same item added again', async () => {
      await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 1, options: [] });
      const cart = await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 2, options: [] });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(3);
    });

    it('throws 409 when adding item from a different restaurant', async () => {
      const otherOwner = await createUser({ email: 'other@test.com', role: 'restaurant_owner' });
      const otherRestaurant = await createRestaurant(otherOwner._id, { name: 'Other' });
      const otherCategory = await createCategory(otherRestaurant._id);
      const otherItem = await createMenuItem(otherRestaurant._id, otherCategory._id, { name: 'Kebab', price: 60 });

      await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 1, options: [] });
      await expect(
        cartService.addItem(customer._id, { menuItemId: otherItem._id, quantity: 1, options: [] })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 400 for unavailable item', async () => {
      await createMenuItem(restaurant._id, category._id, { name: 'Hidden', price: 50, isAvailable: false });
      const unavailable = (await require('../../src/models/MenuItem').MenuItem.findOne({ name: 'Hidden' }));
      await expect(
        cartService.addItem(customer._id, { menuItemId: unavailable._id, quantity: 1, options: [] })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('getCart()', () => {
    it('returns empty cart for new customer', async () => {
      const cart = await cartService.getCart(customer._id);
      expect(cart.items).toHaveLength(0);
    });

    it('calculates pricing correctly', async () => {
      await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 2, options: [] });
      const cart = await cartService.getCart(customer._id);
      // 2 x 100 = 200 subtotal
      expect(cart.pricing.subtotal).toBe(200);
      expect(cart.pricing.total).toBeGreaterThan(200); // includes delivery + tax
    });
  });

  describe('removeItem()', () => {
    it('removes item from cart', async () => {
      const cart = await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 1, options: [] });
      const cartItemId = cart.items[0].cartItemId;
      const updated = await cartService.removeItem(customer._id, cartItemId);
      expect(updated.items).toHaveLength(0);
    });
  });

  describe('clearCart()', () => {
    it('deletes the cart document', async () => {
      await cartService.addItem(customer._id, { menuItemId: item1._id, quantity: 1, options: [] });
      await cartService.clearCart(customer._id);
      const cart = await Cart.findOne({ customerId: customer._id });
      expect(cart).toBeNull();
    });
  });
});
