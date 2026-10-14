const Item = require('../models/Item');
const BorrowRequest = require('../models/BorrowRequest');
const Transaction = require('../models/Transaction');
const { today } = require('../utils/dates');

const PREVIEW = 5;
const person = 'name college profileImage';

const section = async (Model, filter, sort, populate = true) => {
  let query = Model.find(filter).sort(sort).limit(PREVIEW);
  if (populate) {
    query = query
      .populate('itemId', 'title images lendingType price')
      .populate('borrowerId', person)
      .populate('ownerId', person);
  }
  const [items, count] = await Promise.all([query, Model.countDocuments(filter)]);
  return { count, items };
};

module.exports = async (userId) => {
  const either = { $or: [{ ownerId: userId }, { borrowerId: userId }] };
  const [listings, incoming, requests, borrowed, lent, completed, overdue] = await Promise.all([
    section(Item, { ownerId: userId, listingStatus: { $ne: 'removed' } }, { createdAt: -1, _id: -1 }, false),
    section(BorrowRequest, { ownerId: userId, status: 'pending' }, { createdAt: -1, _id: -1 }),
    section(BorrowRequest, { borrowerId: userId, status: { $in: ['pending', 'approved'] } }, { createdAt: -1, _id: -1 }),
    section(Transaction, { borrowerId: userId, currentStatus: 'active' }, { dueAt: 1, _id: 1 }),
    section(Transaction, { ownerId: userId, currentStatus: 'active' }, { dueAt: 1, _id: 1 }),
    section(Transaction, { ...either, currentStatus: 'completed' }, { completedAt: -1, _id: -1 }),
    section(Transaction, { ...either, currentStatus: 'active', dueAt: { $lte: today() } }, { dueAt: 1, _id: 1 }),
  ]);
  return { listings, incoming, requests, borrowed, lent, completed, overdue };
};
