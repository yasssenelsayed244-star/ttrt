const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Initiate card payment for an order
router.post(
  '/initiate/:orderId',
  protect,
  authorize('customer'),
  asyncHandler(async (req, res) => {
    const billingData = req.body.billingData || {
      first_name: req.user.profile?.firstName || 'Customer',
      last_name: req.user.profile?.lastName || 'User',
      email: req.user.email || 'customer@quickbite.com',
      phone_number: req.user.phone || '+201000000000',
      apartment: 'NA', floor: 'NA', building: 'NA',
      street: 'NA', city: 'Cairo', country: 'EGY',
    };

    const result = await paymentService.initiatePayment(req.params.orderId, req.user._id, billingData);
    return ApiResponse.success(res, result, 'Payment session created');
  })
);

// Paymob webhook (no auth — verified via HMAC)
router.post(
  '/webhook/paymob',
  asyncHandler(async (req, res) => {
    const hmac = req.query.hmac;
    await paymentService.handleWebhook(req.body, hmac);
    return res.status(200).send('OK'); // Paymob expects 200
  })
);

// Admin: manual refund
router.post(
  '/refund/:orderId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const result = await paymentService.refund(req.params.orderId);
    return ApiResponse.success(res, result, 'Refund processed');
  })
);

module.exports = router;
