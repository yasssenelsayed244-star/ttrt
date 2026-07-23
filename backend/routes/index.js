const express = require('express');
const router = express.Router();

const authRoutes         = require('./authRoutes');
const restaurantRoutes   = require('./restaurantRoutes');
const menuRoutes         = require('./menuRoutes');
const cartRoutes         = require('./cartRoutes');
const orderRoutes        = require('./orderRoutes');
const driverRoutes       = require('./driverRoutes');
const notificationRoutes = require('./notificationRoutes');
const adminRoutes        = require('./adminRoutes');
const uploadRoutes       = require('./uploadRoutes');
const promoRoutes        = require('./promoRoutes');
const userRoutes         = require('./userRoutes');
const reviewRoutes       = require('./reviewRoutes');
const searchRoutes       = require('./searchRoutes');
const analyticsRoutes    = require('./analyticsRoutes');
const paymentRoutes      = require('./paymentRoutes');

router.use('/auth',          authRoutes);
router.use('/restaurants',   restaurantRoutes);
router.use('/menu',          menuRoutes);
router.use('/cart',          cartRoutes);
router.use('/orders',        orderRoutes);
router.use('/drivers',       driverRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin',         adminRoutes);
router.use('/uploads',       uploadRoutes);
router.use('/promos',        promoRoutes);
router.use('/me',            userRoutes);
router.use('/reviews',       reviewRoutes);
router.use('/search',        searchRoutes);
router.use('/analytics',     analyticsRoutes);
router.use('/payments',      paymentRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'QuickBite API is running',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
