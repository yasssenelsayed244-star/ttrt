process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const request = require('supertest');
const app = require('../../src/app');
const {
  connectTestDB, clearTestDB, closeTestDB,
  createUser, createRestaurant,
} = require('../helpers');
const authService = require('../../src/services/authService');

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

const getToken = async (role = 'customer', email) => {
  const user = await createUser({ email: email || `${role}_${Date.now()}@t.com`, role });
  const { tokens } = await authService.login({ email: user.email, password: 'Test@1234' });
  return { user, token: tokens.accessToken };
};

describe('GET /api/v1/restaurants', () => {
  it('200 — returns list (public, no auth needed)', async () => {
    const owner = await createUser({ email: 'owner@t.com', role: 'restaurant_owner' });
    await createRestaurant(owner._id, { name: 'TestRest' });
    const res = await request(app).get('/api/v1/restaurants');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});

describe('POST /api/v1/restaurants', () => {
  const payload = {
    name: 'New Resto',
    cuisine: ['pizza'],
    address: { street: '1 St', city: 'Cairo', coordinates: { lat: 30, lng: 31 } },
    contact: { phone: '+201001234567' },
    deliveryFee: 10,
    minimumOrder: 50,
  };

  it('201 — owner can create restaurant', async () => {
    const { token } = await getToken('restaurant_owner');
    const res = await request(app)
      .post('/api/v1/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.restaurant.name).toBe('New Resto');
  });

  it('403 — customer cannot create restaurant', async () => {
    const { token } = await getToken('customer');
    const res = await request(app)
      .post('/api/v1/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    const res = await request(app).post('/api/v1/restaurants').send(payload);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/restaurants/:id', () => {
  it('200 — returns restaurant details', async () => {
    const { user: owner } = await getToken('restaurant_owner');
    const restaurant = await createRestaurant(owner._id);
    const res = await request(app).get(`/api/v1/restaurants/${restaurant._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurant._id).toBe(restaurant._id.toString());
  });

  it('404 — non-existent restaurant', async () => {
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';
    const res = await request(app).get(`/api/v1/restaurants/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/restaurants/:id/toggle-open', () => {
  it('200 — owner can toggle open status', async () => {
    const { user: owner, token } = await getToken('restaurant_owner');
    const restaurant = await createRestaurant(owner._id);
    const res = await request(app)
      .patch(`/api/v1/restaurants/${restaurant._id}/toggle-open`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.isOpen).toBe('boolean');
  });

  it('403 — different owner cannot toggle', async () => {
    const { user: owner } = await getToken('restaurant_owner', 'owner1@t.com');
    const { token: otherToken } = await getToken('restaurant_owner', 'owner2@t.com');
    const restaurant = await createRestaurant(owner._id);
    const res = await request(app)
      .patch(`/api/v1/restaurants/${restaurant._id}/toggle-open`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404); // owner sees "not found" for other's restaurant
  });
});
