const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { orderLimiter } = require('../middleware/rateLimit');
const {
  createOrderSchema,
  updateOrderStatusSchema,
  rateOrderSchema,
  cancelOrderSchema,
} = require('../validators/orderValidator');

router.use(protect);

// Customer
router.post('/', authorize('customer'), orderLimiter, validate(createOrderSchema), ctrl.placeOrder);
router.get('/', authorize('customer'), ctrl.getMyOrders);
router.get('/:id/tracking', authorize('customer'), ctrl.getTracking);
router.post('/:id/rate', authorize('customer'), validate(rateOrderSchema), ctrl.rateOrder);
router.patch('/:id/cancel', authorize('customer', 'restaurant_owner', 'admin'), validate(cancelOrderSchema), ctrl.cancelOrder);

// Shared: get single order
router.get('/:id', authorize('customer', 'restaurant_owner', 'driver', 'admin'), ctrl.getOrder);

// Restaurant owner
router.get('/restaurant/:restaurantId', authorize('restaurant_owner', 'admin'), ctrl.getRestaurantOrders);

// Status update (restaurant owner + driver + admin)
router.patch('/:id/status', authorize('restaurant_owner', 'driver', 'admin'), validate(updateOrderStatusSchema), ctrl.updateStatus);

module.exports = router;
