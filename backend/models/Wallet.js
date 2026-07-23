const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true }, // balance AFTER transaction
    description: { type: String, required: true },
    reference: {
      type: String, // orderId, promoId, refundId etc.
    },
    refType: {
      type: String,
      enum: ['order_payment', 'refund', 'top_up', 'reward', 'cashback', 'admin_adjustment'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true, _id: true }
);

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: { type: String, default: 'EGP' },
    transactions: [transactionSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Credit wallet — add funds
 */
walletSchema.methods.credit = async function (amount, description, refType, reference) {
  if (amount <= 0) throw new Error('Credit amount must be positive');
  this.balance = +(this.balance + amount).toFixed(2);
  this.transactions.push({
    type: 'credit',
    amount,
    balance: this.balance,
    description,
    refType,
    reference,
    status: 'completed',
  });
  return this.save();
};

/**
 * Debit wallet — deduct funds
 */
walletSchema.methods.debit = async function (amount, description, refType, reference) {
  if (amount <= 0) throw new Error('Debit amount must be positive');
  if (this.balance < amount) throw new Error('Insufficient wallet balance');
  this.balance = +(this.balance - amount).toFixed(2);
  this.transactions.push({
    type: 'debit',
    amount,
    balance: this.balance,
    description,
    refType,
    reference,
    status: 'completed',
  });
  return this.save();
};

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
