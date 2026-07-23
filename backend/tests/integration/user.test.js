process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, clearTestDB, closeTestDB, createUser } = require('../helpers');
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

const getCustomerToken = async () => {
  const user = await createUser({ email: `cust_${Date.now()}@t.com`, role: 'customer' });
  const { tokens } = await authService.login({ email: user.email, password: 'Test@1234' });
  return { user, token: tokens.accessToken };
};

const validAddress = {
  label: 'home',
  street: '10 Tahrir Square',
  city: 'Cairo',
  coordinates: { lat: 30.044, lng: 31.235 },
};

describe('GET /api/v1/me/profile', () => {
  it('200 — returns user profile', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/v1/me/profile');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/me/profile', () => {
  it('200 — updates first name', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.profile.firstName).toBe('Updated');
  });

  it('400 — invalid phone format', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: 'not-a-phone' });
    expect(res.status).toBe(400);
  });
});

describe('Addresses API', () => {
  it('POST 201 — adds a new address', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .post('/api/v1/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    expect(res.status).toBe(201);
    expect(res.body.data.address.street).toBe('10 Tahrir Square');
    expect(res.body.data.address.isDefault).toBe(true); // first address → auto default
  });

  it('GET 200 — returns address list', async () => {
    const { token } = await getCustomerToken();
    await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`).send(validAddress);
    const res = await request(app).get('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.addresses).toHaveLength(1);
  });

  it('DELETE 200 — removes address', async () => {
    const { token } = await getCustomerToken();
    const add = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`).send(validAddress);
    const id = add.body.data.address._id;
    const res = await request(app).delete(`/api/v1/me/addresses/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('400 — rejects address over limit', async () => {
    const { token } = await getCustomerToken();
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, street: `Street ${i}` });
    }
    const res = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, street: 'Street 6' });
    expect(res.status).toBe(400);
  });
});

describe('Wallet API', () => {
  it('GET /me/wallet — returns zero balance for new user', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app).get('/api/v1/me/wallet').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.wallet.balance).toBe(0);
  });

  it('POST /me/wallet/top-up — increases balance', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .post('/api/v1/me/wallet/top-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 150 });
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(150);
  });

  it('POST /me/wallet/top-up — rejects invalid amount', async () => {
    const { token } = await getCustomerToken();
    const res = await request(app)
      .post('/api/v1/me/wallet/top-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -10 });
    expect(res.status).toBe(400);
  });
});
