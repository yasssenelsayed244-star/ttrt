const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/driverController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.use(protect);

// Any authenticated user can register as driver
router.post('/register', ctrl.register);

// Driver-only routes
router.get('/profile', authorize('driver'), ctrl.getProfile);
router.patch('/location', authorize('driver'), ctrl.updateLocation);
router.patch('/status', authorize('driver'), ctrl.updateStatus);
router.get('/deliveries', authorize('driver'), ctrl.getDeliveries);
router.get('/earnings', authorize('driver'), ctrl.getEarnings);

// Admin
router.get('/', authorize('admin'), ctrl.listAll);

module.exports = router;
