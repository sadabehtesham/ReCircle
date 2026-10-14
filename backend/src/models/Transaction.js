const { Schema, model } = require('mongoose');
const { LENDING_TYPES, CONDITIONS } = require('../utils/constants');
const { today } = require('../utils/dates');

const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

const transactionSchema = new Schema(
  {
    requestId: { ...ref('BorrowRequest'), required: true, unique: true },
    itemId: { ...ref('Item'), required: true },
    ownerId: { ...ref('User'), required: true },
    borrowerId: { ...ref('User'), required: true },
    type: { type: String, enum: LENDING_TYPES, required: true },
    pickupAt: { type: Date, required: true },
    dueAt: Date,
    returnedAt: Date,
    completedAt: Date,
    currentStatus: { type: String, enum: ['active', 'completed'], required: true },
    conditionBefore: { type: String, enum: CONDITIONS },
    conditionAfter: { type: String, enum: CONDITIONS },
    price: { type: Number, min: 0 },
    paymentReceivedAt: Date,
    handedOverBy: ref('User'),
    returnConfirmedBy: ref('User'),
  },
  { timestamps: true, toJSON: { virtuals: true }, id: false }
);

transactionSchema.index({ ownerId: 1, currentStatus: 1, createdAt: -1 });
transactionSchema.index({ borrowerId: 1, currentStatus: 1, createdAt: -1 });

transactionSchema.virtual('overdue').get(function () {
  return this.currentStatus === 'active' && today() >= this.dueAt;
});

module.exports = model('Transaction', transactionSchema);
