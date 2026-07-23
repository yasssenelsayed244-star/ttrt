/**
 * Test helpers
 *
 * NOTE: mongodb-memory-server cannot download binaries in this sandbox.
 * Tests use jest.mock() for services that need DB access.
 * Integration tests mock mongoose models directly.
 *
 * To run tests locally with a real DB:
 *   MONGODB_URI=mongodb://localhost:27017/quickbite_test npm test
 */

const mongoose = require('mongoose');

const connectTestDB = async () => {
  const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/quickbite_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }
};

const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map(col => col.deleteMany({})));
};

const closeTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

// ─── Factories ────────────────────────────────────────────────────────────────

const User = require('../src/models/User');
const Restaurant = require('../src/models/Restaurant');
const { MenuItem, MenuCategory } = require('../src/models/MenuItem');

const createUser = (overrides = {}) =>
  User.create({
    email: overrides.email || `user_${Date.now()}@test.com`,
    password: 'Test@1234',
    role: overrides.role || 'customer',
    profile: { firstName: overrides.firstName || 'Test', lastName: overrides.lastName || 'User' },
    isEmailVerified: true,
    status: overrides.status || 'active',
    ...overrides,
  });

const createRestaurant = (ownerId, overrides = {}) =>
  Restaurant.create({
    ownerId,
    name: overrides.name || 'Test Restaurant',
    cuisine: ['test'],
    address: { street: '1 Test St', city: 'Cairo', coordinates: { lat: 30.06, lng: 31.24 } },
    contact: { phone: '+201001234567' },
    deliveryFee: 15,
    minimumOrder: 50,
    status: 'active',
    isOpen: true,
    ...overrides,
  });

const createCategory = (restaurantId, overrides = {}) =>
  MenuCategory.create({ restaurantId, name: overrides.name || 'Test Category', sortOrder: 1, ...overrides });

const createMenuItem = (restaurantId, categoryId, overrides = {}) =>
  MenuItem.create({ restaurantId, categoryId, name: overrides.name || 'Test Item', price: overrides.price || 50, isAvailable: true, ...overrides });

module.exports = { connectTestDB, clearTestDB, closeTestDB, createUser, createRestaurant, createMenuItem, createCategory };
