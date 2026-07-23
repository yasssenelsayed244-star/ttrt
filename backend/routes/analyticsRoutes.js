const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.use(protect);
router.use(authorize('admin'));

router.get('/kpis',             ctrl.kpis);
router.get('/revenue',          ctrl.revenueChart);
router.get('/orders',           ctrl.ordersBreakdown);
router.get('/top-restaurants',  ctrl.topRestaurants);
router.get('/top-customers',    ctrl.topCustomers);
router.get('/drivers',          ctrl.driverStats);
router.get('/cuisines',         ctrl.cuisineBreakdown);

module.exports = router;
