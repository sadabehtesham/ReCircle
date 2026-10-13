const { Schema, model } = require('mongoose');
const { CATEGORIES, CONDITIONS, LENDING_TYPES } = require('../utils/constants');

const itemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    category: { type: String, enum: CATEGORIES, required: true },
    condition: { type: String, enum: CONDITIONS, required: true },
    images: {
      type: [{ _id: false, url: String, publicId: String }],
      validate: [(images) => images.length >= 1 && images.length <= 5, 'Items need 1 to 5 photos'],
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lendingType: { type: String, enum: LENDING_TYPES, required: true },
    pickupLocation: { type: String, required: true, trim: true, maxlength: 100 },
    listingStatus: { type: String, enum: ['available', 'unavailable', 'removed'], default: 'available' },
  },
  { timestamps: true }
);

itemSchema.index({ listingStatus: 1, category: 1, createdAt: -1 });

module.exports = model('Item', itemSchema);
