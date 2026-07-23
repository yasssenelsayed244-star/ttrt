const axios = require('axios');
const crypto = require('crypto');
const { Order } = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const PAYMOB_BASE = 'https://accept.paymob.com/api';
const PAYMOB_API_KEY     = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID; // card
const PAYMOB_IFRAME_ID   = process.env.PAYMOB_IFRAME_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

const paymentService = {
  /**
   * Step 1: Get Paymob auth token
   */
  async _getAuthToken() {
    const response = await axios.post(`${PAYMOB_BASE}/auth/tokens`, {
      api_key: PAYMOB_API_KEY,
    });
    return response.data.token;
  },

  /**
   * Step 2: Register order with Paymob
   */
  async _registerOrder(authToken, order) {
    const amountCents = Math.round(order.pricing.total * 100); // EGP → cents

    const response = await axios.post(`${PAYMOB_BASE}/ecommerce/orders`, {
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: order.orderNumber,
      items: order.items.map((item) => ({
        name: item.name,
        amount_cents: Math.round(item.unitPrice * 100),
        description: item.name,
        quantity: item.quantity,
      })),
    });

    return response.data.id;
  },

  /**
   * Step 3: Get payment key
   */
  async _getPaymentKey(authToken, paymobOrderId, order, billingData) {
    const amountCents = Math.round(order.pricing.total * 100);

    const response = await axios.post(`${PAYMOB_BASE}/acceptance/payment_keys`, {
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: billingData,
      currency: 'EGP',
      integration_id: PAYMOB_INTEGRATION_ID,
    });

    return response.data.token;
  },

  /**
   * Create a Paymob payment session for a QuickBite order
   * Returns iframe URL for frontend redirect
   */
  async initiatePayment(orderId, customerId, billingData) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) throw new AppError('Order not found', 404);

    if (order.payment.method !== 'card') {
      throw new AppError('Payment method is not card', 400);
    }
    if (order.payment.status === 'paid') {
      throw new AppError('Order already paid', 400);
    }

    try {
      const authToken     = await this._getAuthToken();
      const paymobOrderId = await this._registerOrder(authToken, order);
      const paymentKey    = await this._getPaymentKey(authToken, paymobOrderId, order, billingData);

      const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;

      // Store paymob order id for webhook verification
      order.payment.transactionId = paymobOrderId.toString();
      await order.save();

      logger.info(`Payment initiated for order ${order.orderNumber}`);

      return { iframeUrl, paymentKey, orderId: order._id };
    } catch (err) {
      logger.error(`Paymob payment initiation failed: ${err.message}`);
      throw new AppError('Payment initiation failed. Please try again.', 502);
    }
  },

  /**
   * Handle Paymob webhook callback
   * Called by Paymob when payment succeeds or fails
   */
  async handleWebhook(body, hmacFromHeader) {
    // Verify HMAC signature
    if (!this._verifyHMAC(body, hmacFromHeader)) {
      throw new AppError('Invalid HMAC signature', 401);
    }

    const { obj: transaction } = body;
    if (!transaction) return;

    const orderNumber = transaction.order?.merchant_order_id;
    if (!orderNumber) return;

    const order = await Order.findOne({ orderNumber });
    if (!order) return;

    if (transaction.success === true) {
      order.payment.status = 'paid';
      order.payment.transactionId = transaction.id?.toString();
      await order.save();

      logger.info(`Payment confirmed for order ${order.orderNumber}`);
    } else {
      order.payment.status = 'failed';
      await order.save();

      // Notify customer
      const { addNotificationJob } = require('../config/queues');
      await addNotificationJob({
        userId: order.customerId.toString(),
        type: 'payment',
        title: 'Payment Failed',
        body: `Payment for order #${order.orderNumber} failed. Please try again.`,
        data: { orderId: order._id.toString() },
      }).catch(() => {});

      logger.warn(`Payment failed for order ${order.orderNumber}`);
    }
  },

  /**
   * Process a refund via Paymob (for cancelled paid orders)
   */
  async refund(orderId) {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.payment.status !== 'paid') {
      throw new AppError('Order is not paid', 400);
    }

    try {
      const authToken = await this._getAuthToken();
      const amountCents = Math.round(order.pricing.total * 100);

      await axios.post(`${PAYMOB_BASE}/acceptance/void_refund/refund`, {
        auth_token: authToken,
        transaction_id: order.payment.transactionId,
        amount_cents: amountCents,
      });

      order.payment.status = 'refunded';
      await order.save();

      logger.info(`Refund processed for order ${order.orderNumber}`);
      return { refunded: true, amount: order.pricing.total };
    } catch (err) {
      logger.error(`Refund failed for order ${order.orderNumber}: ${err.message}`);
      throw new AppError('Refund processing failed', 502);
    }
  },

  // ─── HMAC Verification ────────────────────────────────────────────────────

  _verifyHMAC(body, receivedHMAC) {
    if (!PAYMOB_HMAC_SECRET || !receivedHMAC) return false;

    const { obj: t } = body;
    if (!t) return false;

    // Paymob HMAC fields (order must match exactly)
    const hmacString = [
      t.amount_cents, t.created_at, t.currency,
      t.error_occured, t.has_parent_transaction, t.id,
      t.integration_id, t.is_3d_secure, t.is_auth,
      t.is_capture, t.is_refunded, t.is_standalone_payment,
      t.is_voided, t.order?.id, t.owner, t.pending,
      t.source_data?.pan, t.source_data?.sub_type, t.source_data?.type,
      t.success,
    ].join('');

    const computed = crypto
      .createHmac('sha512', PAYMOB_HMAC_SECRET)
      .update(hmacString)
      .digest('hex');

    return computed === receivedHMAC;
  },
};

module.exports = paymentService;
