const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { addToCartSchema, updateCartItemSchema } = require('../validators/orderValidator');

router.use(protect);
router.use(authorize('customer'));

router.get('/', ctrl.getCart);
router.post('/items', validate(addToCartSchema), ctrl.addItem);
router.put('/items/:itemId', validate(updateCartItemSchema), ctrl.updateItem);
router.delete('/items/:itemId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);

module.exports = router;
