const { Schema, model } = require('mongoose');
const { NOTIFICATION_TYPES } = require('../utils/constants');

const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 300 },
    link: { type: String, maxlength: 100 },
    relatedEntityId: Schema.Types.ObjectId,
    key: { type: String, unique: true, sparse: true, select: false },
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

module.exports = model('Notification', notificationSchema);
