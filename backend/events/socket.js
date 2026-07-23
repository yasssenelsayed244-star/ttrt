const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Initialize Socket.io
 * Attaches to the HTTP server and stores io globally for use in services
 */
const initSocket = (server) => {
  const { Server } = require('socket.io');

  const allowedOrigins = (process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']
  );

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      },
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Store globally so services can emit events
  global._io = io;

  // ─── Auth Middleware ────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${userId} (${socket.userRole})`);

    // Every user joins their personal room (userId)
    socket.join(userId);

    // ─── Customer Events ──────────────────────────────────────────────────────

    // Track a specific order
    socket.on('order:track', (orderId) => {
      socket.join(`order:${orderId}`);
      logger.debug(`${userId} tracking order ${orderId}`);
    });

    socket.on('order:untrack', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // ─── Driver Events ────────────────────────────────────────────────────────

    if (socket.userRole === 'driver') {
      // Driver joins their zone room for dispatch broadcasts
      socket.on('driver:join_zone', (zone) => {
        socket.join(`zone:${zone}`);
        logger.debug(`Driver ${userId} joined zone ${zone}`);
      });

      socket.on('driver:location', async ({ lat, lng }) => {
        try {
          const driverService = require('../services/driverService');
          await driverService.updateLocation(userId, lat, lng);
        } catch (err) {
          logger.warn(`Location update failed: ${err.message}`);
        }
      });
    }

    // ─── Restaurant Owner Events ───────────────────────────────────────────────

    if (socket.userRole === 'restaurant_owner') {
      // Owner joins their restaurant room to receive new orders
      socket.on('restaurant:join', (restaurantId) => {
        socket.join(`restaurant:${restaurantId}`);
        logger.debug(`Owner ${userId} joined restaurant room ${restaurantId}`);
      });
    }

    // ─── Disconnect ───────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${userId} — ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error for ${userId}: ${err.message}`);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

module.exports = { initSocket };
