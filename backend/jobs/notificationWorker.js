const { notificationQueue, smsQueue, emailQueue } = require('../config/queues');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ─── Notification Worker ──────────────────────────────────────────────────────
// Processes in-app + push notification jobs

notificationQueue.process(async (job) => {
  const { userId, type, title, body, data, channel } = job.data;

  try {
    await notificationService.create(userId, { type, title, body, data, channel });
    logger.debug(`Notification sent to user ${userId}: ${title}`);
  } catch (err) {
    logger.error(`Notification job failed: ${err.message}`);
    throw err; // triggers retry
  }
});

// ─── SMS Worker ───────────────────────────────────────────────────────────────

smsQueue.process(async (job) => {
  const { to, message } = job.data;

  try {
    // In production: use Twilio
    // const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
    // await twilio.messages.create({ body: message, from: config.twilio.phoneNumber, to });
    logger.info(`[SMS] To: ${to} — ${message}`);
  } catch (err) {
    logger.error(`SMS job failed for ${to}: ${err.message}`);
    throw err;
  }
});

// ─── Email Worker ─────────────────────────────────────────────────────────────

emailQueue.process(async (job) => {
  const { to, subject, html, text } = job.data;

  try {
    // In production: use nodemailer / SendGrid / Mailgun
    // await transporter.sendMail({ from: 'noreply@quickbite.com', to, subject, html });
    logger.info(`[Email] To: ${to} — Subject: ${subject}`);
  } catch (err) {
    logger.error(`Email job failed for ${to}: ${err.message}`);
    throw err;
  }
});

logger.info('Notification, SMS, and Email workers started');
