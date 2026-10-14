const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { today, DAY, fmtDay } = require('../utils/dates');

exports.notify = async (docs, session) => {
  const list = [].concat(docs);
  if (session) return Notification.insertMany(list, { session });
  try {
    await Notification.insertMany(list);
  } catch (error) {
    console.error('Notification failed', error);
  }
};

const upsert = ({ key, ...document }) =>
  Notification.updateOne({ key }, { $setOnInsert: document }, { upsert: true }).catch((error) => {
    if (error.code !== 11000) throw error;
  });

exports.syncReminders = async (userId) => {
  const now = today();
  const loans = await Transaction.find({
    type: 'borrow',
    currentStatus: 'active',
    dueAt: { $lte: new Date(now.getTime() + 2 * DAY) },
    $or: [{ borrowerId: userId }, { ownerId: userId }],
  })
    .populate('itemId', 'title')
    .populate('borrowerId', 'name');

  const notifications = [];
  for (const transaction of loans) {
    const itemTitle = transaction.itemId.title;
    const lastDay = fmtDay(new Date(transaction.dueAt.getTime() - DAY));
    const isBorrower = transaction.borrowerId._id.equals(userId);
    const base = {
      recipientId: userId,
      relatedEntityId: transaction._id,
      link: isBorrower ? '/loans' : '/loans?role=owner',
    };

    if (transaction.dueAt > now) {
      if (isBorrower) {
        notifications.push({
          ...base,
          key: `due_soon:${transaction._id}`,
          type: 'due_soon',
          title: 'Due soon',
          message: `Please return “${itemTitle}” by ${lastDay}.`,
        });
      }
    } else {
      notifications.push({
        ...base,
        key: `overdue:${transaction._id}:${userId}`,
        type: 'overdue',
        title: 'Overdue item',
        message: isBorrower
          ? `“${itemTitle}” was due back on ${lastDay}. Please return it now.`
          : `${transaction.borrowerId.name} has not returned “${itemTitle}” (due ${lastDay}).`,
      });
    }
  }
  await Promise.all(notifications.map(upsert));
};
