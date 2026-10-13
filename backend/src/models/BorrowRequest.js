const { Schema, model } = require('mongoose');
const { LENDING_TYPES, REQUEST_STATUSES, OPEN_STATUSES } = require('../utils/constants');

const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

const requestSchema = new Schema(
  {
    itemId: { ...ref('Item'), required: true },
    ownerId: { ...ref('User'), required: true },
    borrowerId: { ...ref('User'), required: true },
    type: { type: String, enum: LENDING_TYPES, required: true },
    startDate: { type: Date, required() { return this.type === 'borrow'; } },
    endDate: { type: Date, required() { return this.type === 'borrow'; } },
    message: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending' },
    reviewedBy: ref('User'),
    reviewedAt: Date,
    cancelledBy: ref('User'),
  },
  { timestamps: true }
);

requestSchema.index(
  { itemId: 1, borrowerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_STATUSES } } }
);
requestSchema.index({ borrowerId: 1, createdAt: -1 });
requestSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
requestSchema.index({ itemId: 1, status: 1, startDate: 1 });

module.exports = model('BorrowRequest', requestSchema);
