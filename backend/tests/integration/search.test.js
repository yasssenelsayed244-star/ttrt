process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const request = require('supertest');
const app = require('../../src/app');
const {
  connectTestDB, clearTestDB, closeTestDB,
  createUser, createRestaurant, createCategory, createMenuItem,
} = require('../helpers');

jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(null),
  getCache: jest.fn().mockResolvedValue(null),
  deleteCache: jest.fn().mockResolvedValue(null),
  deleteCacheByPattern: jest.fn().mockResolvedValue(null),
}));

beforeAll(() => connectTestDB());
afterEach(() => clearTestDB());
afterAll(() => closeTestDB());

describe('GET /api/v1/search', () => {
  beforeEach(async () => {
    const owner = await createUser({ email: 'owner@test.com', role: 'restaurant_owner' });
    const r = await createRestaurant(owner._id, { name: 'Sushi World', cuisine: ['japanese', 'sushi'] });
    const cat = await createCategory(r._id);
    await createMenuItem(r._id, cat._id, { name: 'Dragon Roll', price: 200 });
  });

  it('200 — returns restaurants and items for valid query', async () => {
    const res = await request(app).get('/api/v1/search?q=Sushi');
    expect(res.status).toBe(200);
    expect(res.body.data.restaurants.length).toBeGreaterThan(0);
  });

  it('200 — finds menu items', async () => {
    const res = await request(app).get('/api/v1/search?q=Dragon');
    expect(res.status).toBe(200);
    expect(res.body.data.menuItems.length).toBeGreaterThan(0);
  });

  it('200 — empty results for non-matching query', async () => {
    const res = await request(app).get('/api/v1/search?q=nothinghere999');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });
});

describe('GET /api/v1/search/autocomplete', () => {
  beforeEach(async () => {
    const owner = await createUser({ email: 'ac_owner@test.com', role: 'restaurant_owner' });
    await createRestaurant(owner._id, { name: 'Tacos Paradise' });
  });

  it('200 — returns suggestions for prefix', async () => {
    const res = await request(app).get('/api/v1/search/autocomplete?q=Tac');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);
  });

  it('200 — empty array for short query', async () => {
    const res = await request(app).get('/api/v1/search/autocomplete?q=T');
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toHaveLength(0);
  });
});

describe('GET /api/v1/search/filter', () => {
  beforeEach(async () => {
    const owner = await createUser({ email: 'filter_owner@test.com', role: 'restaurant_owner' });
    await createRestaurant(owner._id, {
      name: 'Burger Joint',
      cuisine: ['burgers'],
      deliveryFee: 10,
      isOpen: true,
    });
    await createRestaurant(owner._id, {
      name: 'Expensive Place',
      cuisine: ['fine_dining'],
      deliveryFee: 60,
      isOpen: false,
    });
  });

  it('200 — filters by max delivery fee', async () => {
    const res = await request(app).get('/api/v1/search/filter?maxDeliveryFee=20');
    expect(res.status).toBe(200);
    expect(res.body.data.every(r => r.deliveryFee <= 20)).toBe(true);
  });

  it('200 — filters open only', async () => {
    const res = await request(app).get('/api/v1/search/filter?isOpen=true');
    expect(res.status).toBe(200);
    expect(res.body.data.every(r => r.isOpen === true)).toBe(true);
  });
});
