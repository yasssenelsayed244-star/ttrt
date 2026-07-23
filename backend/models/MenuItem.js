const mongoose = require('mongoose');

// ─── Menu Category ───────────────────────────────────────────────────────────

const menuCategorySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuCategorySchema.index({ restaurantId: 1, sortOrder: 1 });

const MenuCategory = mongoose.model('MenuCategory', menuCategorySchema);

// ─── Menu Item ────────────────────────────────────────────────────────────────

const choiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 }, // extra cost
  },
  { _id: false }
);

const optionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Size", "Spiciness"
    required: { type: Boolean, default: false },
    multiple: { type: Boolean, default: false }, // allow multi-select
    choices: [choiceSchema],
  },
  { _id: true }
);

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuCategory',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    image: String,
    options: [optionSchema],
    isAvailable: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    preparationTime: { type: Number, default: 15 }, // minutes
    calories: Number,
    tags: [{ type: String, lowercase: true }], // ['vegetarian', 'spicy', 'gluten-free']
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

menuItemSchema.index({ restaurantId: 1, categoryId: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });
menuItemSchema.index({ tags: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = { MenuItem, MenuCategory };
