process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/quickbite_test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_for_jest';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_jest';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
