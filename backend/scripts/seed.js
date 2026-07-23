require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { MenuItem, MenuCategory } = require('../models/MenuItem');
const Driver = require('../models/Driver');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quickbite';

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB for seeding...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Restaurant.deleteMany({}),
      MenuItem.deleteMany({}),
      MenuCategory.deleteMany({}),
      Driver.deleteMany({}),
    ]);
    logger.info('Cleared existing data');

    // ─── Users ────────────────────────────────────────────────────────────────
    const users = await User.create([
      {
        email: 'admin@quickbite.com',
        password: 'Admin@1234',
        role: 'admin',
        profile: { firstName: 'Admin', lastName: 'User' },
        isEmailVerified: true,
        status: 'active',
      },
      {
        email: 'owner@pizzapalace.com',
        password: 'Owner@1234',
        phone: '+201001234567',
        role: 'restaurant_owner',
        profile: { firstName: 'Ahmed', lastName: 'Hassan' },
        isEmailVerified: true,
        isPhoneVerified: true,
        status: 'active',
      },
      {
        email: 'driver@quickbite.com',
        password: 'Driver@1234',
        phone: '+201009876543',
        role: 'driver',
        profile: { firstName: 'Mohamed', lastName: 'Ali' },
        isEmailVerified: true,
        status: 'active',
      },
      {
        email: 'customer@example.com',
        password: 'Customer@1234',
        phone: '+201112223344',
        role: 'customer',
        profile: {
          firstName: 'Sara',
          lastName: 'Khaled',
          address: { street: '10 Tahrir Square', city: 'Cairo' },
        },
        isEmailVerified: true,
        status: 'active',
      },
    ]);

    logger.info(`Created ${users.length} users`);

    // ─── Restaurant ───────────────────────────────────────────────────────────
    const restaurant = await Restaurant.create({
      ownerId: users[1]._id,
      name: 'Pizza Palace',
      description: 'Authentic Italian pizzas in Cairo',
      cuisine: ['italian', 'pizza'],
      address: {
        street: '15 Nasr City',
        city: 'Cairo',
        coordinates: { lat: 30.0626, lng: 31.3298 },
      },
      contact: { phone: '+201001234567', email: 'owner@pizzapalace.com' },
      operatingHours: {
        monday: { open: '10:00', close: '23:00', isOpen: true },
        tuesday: { open: '10:00', close: '23:00', isOpen: true },
        wednesday: { open: '10:00', close: '23:00', isOpen: true },
        thursday: { open: '10:00', close: '23:00', isOpen: true },
        friday: { open: '12:00', close: '00:00', isOpen: true },
        saturday: { open: '12:00', close: '00:00', isOpen: true },
        sunday: { open: '12:00', close: '23:00', isOpen: true },
      },
      deliveryFee: 15,
      minimumOrder: 100,
      estimatedDeliveryTime: 35,
      status: 'active',
      isOpen: true,
      rating: { average: 4.5, count: 120 },
    });

    // ─── Menu Categories ──────────────────────────────────────────────────────
    const categories = await MenuCategory.create([
      { restaurantId: restaurant._id, name: 'Pizzas', sortOrder: 1 },
      { restaurantId: restaurant._id, name: 'Sides', sortOrder: 2 },
      { restaurantId: restaurant._id, name: 'Drinks', sortOrder: 3 },
    ]);

    // ─── Menu Items ───────────────────────────────────────────────────────────
    await MenuItem.create([
      {
        restaurantId: restaurant._id,
        categoryId: categories[0]._id,
        name: 'Margherita',
        description: 'Classic tomato sauce, mozzarella, fresh basil',
        price: 120,
        options: [
          {
            name: 'Size',
            required: true,
            multiple: false,
            choices: [
              { name: 'Small (25cm)', price: 0 },
              { name: 'Medium (30cm)', price: 30 },
              { name: 'Large (35cm)', price: 55 },
            ],
          },
        ],
        isAvailable: true,
        isPopular: true,
        preparationTime: 20,
        calories: 800,
        tags: ['vegetarian'],
      },
      {
        restaurantId: restaurant._id,
        categoryId: categories[0]._id,
        name: 'Pepperoni',
        description: 'Loaded with premium pepperoni',
        price: 150,
        options: [
          {
            name: 'Size',
            required: true,
            multiple: false,
            choices: [
              { name: 'Small', price: 0 },
              { name: 'Large', price: 55 },
            ],
          },
          {
            name: 'Extra Toppings',
            required: false,
            multiple: true,
            choices: [
              { name: 'Extra Cheese', price: 20 },
              { name: 'Jalapeños', price: 10 },
            ],
          },
        ],
        isAvailable: true,
        isPopular: true,
        preparationTime: 20,
        calories: 950,
        tags: ['spicy'],
      },
      {
        restaurantId: restaurant._id,
        categoryId: categories[1]._id,
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter',
        price: 45,
        isAvailable: true,
        preparationTime: 10,
        calories: 320,
        tags: ['vegetarian'],
      },
      {
        restaurantId: restaurant._id,
        categoryId: categories[2]._id,
        name: 'Soft Drink',
        description: 'Pepsi, 7UP, or Mirinda',
        price: 25,
        options: [
          {
            name: 'Flavor',
            required: true,
            multiple: false,
            choices: [
              { name: 'Pepsi', price: 0 },
              { name: '7UP', price: 0 },
              { name: 'Mirinda', price: 0 },
            ],
          },
        ],
        isAvailable: true,
        preparationTime: 2,
        calories: 150,
      },
    ]);

    // ─── Driver ───────────────────────────────────────────────────────────────
    await Driver.create({
      userId: users[2]._id,
      vehicle: { type: 'motorcycle', plateNumber: 'ABC-123', color: 'Red' },
      documents: {
        idCard: 'https://cloudinary.com/placeholder/id.jpg',
        license: 'https://cloudinary.com/placeholder/license.jpg',
        isVerified: true,
      },
      currentLocation: {
        coordinates: { lat: 30.058, lng: 31.235 },
        updatedAt: new Date(),
      },
      status: 'available',
      zone: 'cairo_east',
      rating: { average: 4.8, count: 85 },
      totalDeliveries: 85,
    });

    logger.info('✅ Seed complete!');
    logger.info('\n📋 Test Accounts:');
    logger.info('  Admin:     admin@quickbite.com / Admin@1234');
    logger.info('  Owner:     owner@pizzapalace.com / Owner@1234');
    logger.info('  Driver:    driver@quickbite.com / Driver@1234');
    logger.info('  Customer:  customer@example.com / Customer@1234');

  } catch (error) {
    logger.error('Seed failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
