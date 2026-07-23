const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Public
router.get('/restaurant/:restaurantId', ctrl.getForRestaurant);

router.use(protect);

// Customer
router.post('/',           authorize('customer'), ctrl.create);
router.get('/mine',        authorize('customer'), ctrl.getMyReviews);

// Owner reply
router.post('/:id/reply',  authorize('restaurant_owner'), ctrl.replyToReview);

// Admin
router.patch('/:id/flag',  authorize('admin'), ctrl.flagReview);

module.exports = router;
