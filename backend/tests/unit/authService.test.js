process.env.MONGODB_URI        = 'mongodb://localhost/test';
process.env.JWT_ACCESS_SECRET  = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const { connectTestDB, clearTestDB, closeTestDB, createUser } = require('../helpers');
const authService = require('../../src/services/authService');

jest.mock('../../src/config/redis', () => ({
  setCache: jest.fn().mockResolvedValue(null),
  getCache: jest.fn().mockResolvedValue(null),
  deleteCache: jest.fn().mockResolvedValue(null),
  deleteCacheByPattern: jest.fn().mockResolvedValue(null),
}));

beforeAll(() => connectTestDB());
afterEach(() => clearTestDB());
afterAll(() => closeTestDB());

describe('AuthService', () => {

  describe('register()', () => {
    it('creates a new user and returns tokens', async () => {
      const result = await authService.register({
        email: 'test@example.com', password: 'Test@1234',
        firstName: 'Ahmed', lastName: 'Hassan', role: 'customer',
      });
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user.password).toBeUndefined();
    });

    it('throws 409 if email already exists', async () => {
      await createUser({ email: 'dup@example.com' });
      await expect(
        authService.register({ email: 'dup@example.com', password: 'Test@1234', firstName: 'A', lastName: 'B' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login()', () => {
    it('returns tokens for valid credentials', async () => {
      await createUser({ email: 'login@test.com', password: 'Test@1234' });
      const result = await authService.login({ email: 'login@test.com', password: 'Test@1234' });
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('throws 401 for wrong password', async () => {
      await createUser({ email: 'wrong@test.com', password: 'Test@1234' });
      await expect(authService.login({ email: 'wrong@test.com', password: 'WrongPass1' }))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 403 for suspended account', async () => {
      await createUser({ email: 'sus@test.com', password: 'Test@1234', status: 'suspended' });
      await expect(authService.login({ email: 'sus@test.com', password: 'Test@1234' }))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('refreshTokens()', () => {
    it('issues new token pair on valid refresh token', async () => {
      const reg = await authService.register({
        email: 'refresh@test.com', password: 'Test@1234', firstName: 'A', lastName: 'B',
      });
      const result = await authService.refreshTokens(reg.tokens.refreshToken);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('throws 401 for invalid refresh token', async () => {
      await expect(authService.refreshTokens('invalid.token.here'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('changePassword()', () => {
    it('updates password successfully', async () => {
      const user = await createUser({ email: 'change@test.com', password: 'Test@1234' });
      await expect(authService.changePassword(user._id, 'Test@1234', 'NewPass@5678'))
        .resolves.not.toThrow();
    });

    it('throws 401 for wrong current password', async () => {
      const user = await createUser({ email: 'badchange@test.com', password: 'Test@1234' });
      await expect(authService.changePassword(user._id, 'WrongOld@1', 'NewPass@5678'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('verifyPhoneOTP()', () => {
    it('verifies phone with correct OTP', async () => {
      const user = await createUser({ email: 'otp@test.com', phone: '+201001111111' });
      const otp = await authService.sendPhoneOTP(user);
      const result = await authService.verifyPhoneOTP('+201001111111', otp);
      expect(result.isPhoneVerified).toBe(true);
    });

    it('throws 400 for wrong OTP', async () => {
      const user = await createUser({ email: 'badotp@test.com', phone: '+201002222222' });
      await authService.sendPhoneOTP(user);
      await expect(authService.verifyPhoneOTP('+201002222222', '000000'))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
