process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, clearTestDB, closeTestDB } = require('../helpers');

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

describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    email: 'newuser@test.com',
    password: 'Test@1234',
    firstName: 'Sara',
    lastName: 'Khaled',
    role: 'customer',
  };

  it('201 — registers successfully', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('newuser@test.com');
  });

  it('400 — missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — weak password', async () => {
    const res = await request(app).post('/api/v1/auth/register')
      .send({ ...validPayload, password: '123456' });
    expect(res.status).toBe(400);
  });

  it('409 — duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'logintest@test.com', password: 'Test@1234',
      firstName: 'A', lastName: 'B',
    });
  });

  it('200 — valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'logintest@test.com', password: 'Test@1234' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('401 — wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'logintest@test.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('400 — missing password field', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'logintest@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('200 — returns user with valid token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'me@test.com', password: 'Test@1234', firstName: 'X', lastName: 'Y',
    });
    const token = reg.body.data.accessToken;
    const res = await request(app).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@test.com');
  });

  it('401 — no token provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 — invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me')
      .set('Authorization', 'Bearer totally.invalid.token');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/health', () => {
  it('200 — health check passes', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
