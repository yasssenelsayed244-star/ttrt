const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

router.use(protect);
router.use(authorize('customer'));

// Profile
router.get('/profile',        ctrl.getProfile);
router.patch('/profile',      ctrl.updateProfile);
router.delete('/account',     ctrl.deleteAccount);

// Addresses
router.get('/addresses',              ctrl.getAddresses);
router.post('/addresses',             ctrl.addAddress);
router.put('/addresses/:id',          ctrl.updateAddress);
router.delete('/addresses/:id',       ctrl.deleteAddress);
router.patch('/addresses/:id/default',ctrl.setDefault);

// Order history
router.get('/orders', ctrl.getOrderHistory);

// Favourites
router.get('/favourites',                    ctrl.getFavourites);
router.post('/favourites/:restaurantId',     ctrl.toggleFavourite);

// Wallet
router.get('/wallet',              ctrl.getWallet);
router.get('/wallet/transactions', ctrl.getTransactions);
router.post('/wallet/top-up',      ctrl.topUp);

module.exports = router;
