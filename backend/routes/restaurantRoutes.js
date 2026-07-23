const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/restaurantController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createRestaurantSchema,
  updateRestaurantSchema,
  restaurantQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} = require('../validators/restaurantValidator');

// ─── Public Routes ────────────────────────────────────────────────────────────
router.get('/', validate(restaurantQuerySchema, 'query'), ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/menu', ctrl.getMenu);

// ─── Owner Routes ─────────────────────────────────────────────────────────────
router.use(protect);

router.get('/owner/mine', authorize('restaurant_owner', 'admin'), ctrl.getMyRestaurants);
router.post('/', authorize('restaurant_owner'), validate(createRestaurantSchema), ctrl.create);
router.put('/:id', authorize('restaurant_owner', 'admin'), validate(updateRestaurantSchema), ctrl.update);
router.delete('/:id', authorize('restaurant_owner', 'admin'), ctrl.delete);
router.patch('/:id/toggle-open', authorize('restaurant_owner'), ctrl.toggleOpen);

// ─── Admin Routes ─────────────────────────────────────────────────────────────
router.patch('/:id/approve', authorize('admin'), ctrl.approve);

module.exports = router;
