process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const { connectTestDB, clearTestDB, closeTestDB, createUser } = require('../helpers');
const { Order, ORDER_STATUS } = require('../../src/models/Order');
const mongoose = require('mongoose');

beforeAll(() => connectTestDB());
afterEach(() => clearTestDB());
afterAll(() => closeTestDB());

const makeOrder = async (overrides = {}) => {
  const customer = await createUser({ email: `cust_${Date.now()}@t.com` });
  return Order.create({
    customerId: customer._id,
    restaurantId: new mongoose.Types.ObjectId(),
    items: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'Pizza', quantity: 1, unitPrice: 100, totalPrice: 100 }],
    pricing: { subtotal: 100, deliveryFee: 15, tax: 14, discount: 0, total: 129 },
    deliveryAddress: { street: '1 Test St', coordinates: { lat: 30, lng: 31 } },
    payment: { method: 'cash' },
    status: overrides.status || ORDER_STATUS.PLACED,
    statusHistory: [{ status: overrides.status || ORDER_STATUS.PLACED }],
    ...overrides,
  });
};

describe('Order State Machine', () => {

  describe('canTransitionTo()', () => {
    it('PLACED→CONFIRMED allowed for restaurant_owner', async () => {
      const order = await makeOrder();
      expect(order.canTransitionTo(ORDER_STATUS.CONFIRMED, 'restaurant_owner')).toBe(true);
    });

    it('PLACED→CONFIRMED NOT allowed for customer', async () => {
      const order = await makeOrder();
      expect(order.canTransitionTo(ORDER_STATUS.CONFIRMED, 'customer')).toBe(false);
    });

    it('PLACED→CANCELLED allowed for customer', async () => {
      const order = await makeOrder();
      expect(order.canTransitionTo(ORDER_STATUS.CANCELLED, 'customer')).toBe(true);
    });

    it('DELIVERED→CANCELLED not allowed for anyone', async () => {
      const order = await makeOrder({ status: ORDER_STATUS.DELIVERED });
      expect(order.canTransitionTo(ORDER_STATUS.CANCELLED, 'admin')).toBe(false);
    });

    it('READY→PICKED_UP allowed only for driver', async () => {
      const order = await makeOrder({ status: ORDER_STATUS.READY });
      expect(order.canTransitionTo(ORDER_STATUS.PICKED_UP, 'driver')).toBe(true);
      expect(order.canTransitionTo(ORDER_STATUS.PICKED_UP, 'restaurant_owner')).toBe(false);
    });

    it('admin can do any owner-allowed transition', async () => {
      const order = await makeOrder();
      expect(order.canTransitionTo(ORDER_STATUS.CONFIRMED, 'admin')).toBe(true);
      expect(order.canTransitionTo(ORDER_STATUS.CANCELLED, 'admin')).toBe(true);
    });
  });

  describe('transitionTo()', () => {
    it('updates status and appends history', async () => {
      const order = await makeOrder();
      await order.transitionTo(ORDER_STATUS.CONFIRMED, new mongoose.Types.ObjectId(), 'ok');
      expect(order.status).toBe(ORDER_STATUS.CONFIRMED);
      expect(order.statusHistory).toHaveLength(2);
    });

    it('sets confirmedAt timestamp', async () => {
      const order = await makeOrder();
      await order.transitionTo(ORDER_STATUS.CONFIRMED, new mongoose.Types.ObjectId());
      expect(order.timeline.confirmedAt).toBeInstanceOf(Date);
    });
  });

  describe('orderNumber generation', () => {
    it('generates QB-YYYY-XXXXXX pattern', async () => {
      const order = await makeOrder();
      expect(order.orderNumber).toMatch(/^QB-\d{4}-\d{6}$/);
    });

    it('generates unique numbers', async () => {
      const o1 = await makeOrder();
      const o2 = await makeOrder();
      expect(o1.orderNumber).not.toBe(o2.orderNumber);
    });
  });
});
