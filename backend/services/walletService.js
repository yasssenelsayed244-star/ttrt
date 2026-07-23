const Wallet = require('../models/Wallet');
const { AppError } = require('../middleware/errorHandler');
const { getPagination, buildPaginationMeta } = require('../utils/apiResponse');

const walletService = {
  /**
   * Get or create wallet for user
   */
  async getOrCreate(userId) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0 });
    return wallet;
  },

  async getBalance(userId) {
    const wallet = await this.getOrCreate(userId);
    return { balance: wallet.balance, currency: wallet.currency };
  },

  /**
   * Transaction history with pagination
   */
  async getTransactions(userId, query) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const wallet = await this.getOrCreate(userId);

    let txns = wallet.transactions;
    if (query.type) txns = txns.filter(t => t.type === query.type);

    // Sort newest first, then paginate in memory (transactions are embedded)
    txns = txns.slice().sort((a, b) => b.createdAt - a.createdAt);
    const total = txns.length;
    const paginated = txns.slice(skip, skip + limit);

    return {
      transactions: paginated,
      balance: wallet.balance,
      pagination: buildPaginationMeta(total, page, limit),
    };
  },

  /**
   * Top up — admin grants credit or payment gateway callback
   */
  async topUp(userId, amount, description = 'Wallet top-up', reference = null) {
    if (amount <= 0) throw new AppError('Amount must be positive', 400);
    const wallet = await this.getOrCreate(userId);
    await wallet.credit(amount, description, 'top_up', reference);
    return { balance: wallet.balance };
  },

  /**
   * Pay for order using wallet balance
   */
  async payForOrder(userId, amount, orderId) {
    const wallet = await this.getOrCreate(userId);
    if (wallet.balance < amount) {
      throw new AppError(
        `Insufficient wallet balance. Available: ${wallet.balance} EGP, Required: ${amount} EGP`,
        400
      );
    }
    await wallet.debit(amount, `Payment for order`, 'order_payment', orderId.toString());
    return { balance: wallet.balance };
  },

  /**
   * Refund to wallet after cancellation
   */
  async refund(userId, amount, orderId) {
    const wallet = await this.getOrCreate(userId);
    await wallet.credit(amount, `Refund for order`, 'refund', orderId.toString());
    return { balance: wallet.balance };
  },

  /**
   * Cashback reward (e.g. after first order)
   */
  async addCashback(userId, amount, description = 'Cashback reward') {
    const wallet = await this.getOrCreate(userId);
    await wallet.credit(amount, description, 'cashback');
    return { balance: wallet.balance };
  },

  /**
   * Admin: manual adjustment
   */
  async adminAdjust(userId, amount, description) {
    const wallet = await this.getOrCreate(userId);
    if (amount > 0) {
      await wallet.credit(amount, description, 'admin_adjustment');
    } else {
      await wallet.debit(Math.abs(amount), description, 'admin_adjustment');
    }
    return { balance: wallet.balance };
  },
};

module.exports = walletService;
