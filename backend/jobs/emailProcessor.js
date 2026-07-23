const { emailQueue } = require('./queues');
const logger = require('../utils/logger');

/**
 * Email job processor
 * Swap the TODO block with a real transporter (Nodemailer/SendGrid/Mailgun)
 *
 * Job data shape:
 * { to, subject, html, text? }
 */
emailQueue.process('send', 3, async (job) => {
  const { to, subject, html } = job.data;

  if (process.env.NODE_ENV === 'development') {
    logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return { sent: true, dev: true };
  }

  // TODO: replace with real transporter
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ from: 'noreply@quickbite.com', to, subject, html });

  logger.info(`Email sent to ${to}: ${subject}`);
  return { sent: true };
});

// ─── Templates ────────────────────────────────────────────────────────────────

const sendEmail = (to, subject, html, opts = {}) => {
  return emailQueue.add('send', { to, subject, html }, {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: true,
    ...opts,
  });
};

const sendVerificationEmail = (to, token) => {
  const link = `${process.env.CUSTOMER_APP_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  return sendEmail(
    to,
    'Verify your QuickBite account',
    `<h2>Welcome to QuickBite!</h2><p><a href="${link}">Verify your email</a></p><p>Link expires in 24 hours.</p>`
  );
};

const sendPasswordResetEmail = (to, token) => {
  const link = `${process.env.CUSTOMER_APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  return sendEmail(
    to,
    'Reset your QuickBite password',
    `<h2>Password Reset</h2><p><a href="${link}">Reset your password</a></p><p>Link expires in 1 hour.</p>`
  );
};

const sendOrderConfirmationEmail = (to, order) => {
  return sendEmail(
    to,
    `Order #${order.orderNumber} Confirmed`,
    `<h2>Your order is confirmed!</h2><p>Order #${order.orderNumber} | Total: ${order.pricing.total} EGP</p>`
  );
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };
