const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/restaurantController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} = require('../validators/restaurantValidator');

router.use(protect);
router.use(authorize('restaurant_owner', 'admin'));

// ─── Categories ───────────────────────────────────────────────────────────────
router.post('/categories', validate(createCategorySchema), ctrl.createCategory);
router.put('/categories/:id', validate(updateCategorySchema), ctrl.updateCategory);
router.delete('/categories/:id', ctrl.deleteCategory);

// ─── Items ────────────────────────────────────────────────────────────────────
router.post('/items', validate(createMenuItemSchema), ctrl.createMenuItem);
router.put('/items/:id', validate(updateMenuItemSchema), ctrl.updateMenuItem);
router.patch('/items/:id/availability', ctrl.toggleAvailability);
router.delete('/items/:id', ctrl.deleteMenuItem);

module.exports = router;
