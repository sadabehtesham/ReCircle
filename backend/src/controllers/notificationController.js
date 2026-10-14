const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { syncReminders } = require('../services/notificationService');

const unreadFilter = (user) => ({ recipientId: user._id, readAt: null });

exports.list = async (req, res) => {
  await syncReminders(req.user._id);
  const { unread, page, limit } = req.valid;
  const filter = unread ? unreadFilter(req.user) : { recipientId: req.user._id };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter(req.user)),
  ]);
  res.json({
    success: true,
    data: { notifications, page, limit, total, pages: Math.ceil(total / limit), unreadCount },
  });
};

exports.unreadCount = async (req, res) => {
  await syncReminders(req.user._id);
  res.json({ success: true, data: { count: await Notification.countDocuments(unreadFilter(req.user)) } });
};

exports.markRead = async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipientId: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({ success: true, data: { notification } });
};

exports.markAllRead = async (req, res) => {
  const { modifiedCount } = await Notification.updateMany(unreadFilter(req.user), { readAt: new Date() });
  res.json({ success: true, data: { updated: modifiedCount } });
};
