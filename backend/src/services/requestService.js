const Item = require('../models/Item');
const BorrowRequest = require('../models/BorrowRequest');
const ApiError = require('../utils/ApiError');
const withTxn = require('../utils/transaction');
const { today } = require('../utils/dates');

const iso = (d) => d.toISOString().slice(0, 10);

exports.create = async (user, { itemId, startDate, endDate, message }) => {
  const item = await Item.findById(itemId);
  if (!item || item.listingStatus === 'removed') throw new ApiError(404, 'Item not found');
  if (item.ownerId.equals(user._id)) throw new ApiError(400, 'You cannot request your own item');

  const isBorrow = item.lendingType === 'borrow';
  if (isBorrow !== Boolean(startDate))
    throw new ApiError(400, isBorrow ? 'Start and end dates are required' : 'Dates only apply to borrowing');

  const base = { itemId: item._id, ownerId: item.ownerId, borrowerId: user._id, type: item.lendingType, message };

  if (isBorrow) {
    if (item.listingStatus !== 'available') throw new ApiError(409, 'This item is not available right now');
    return BorrowRequest.create({ ...base, startDate, endDate }).catch((err) => {
      if (err.code === 11000) throw new ApiError(409, 'You already have an open request for this item');
      throw err;
    });
  }

  return withTxn(async (session) => {
    const won = await Item.findOneAndUpdate({ _id: item._id, listingStatus: 'available' }, { listingStatus: 'reserved' }, { session });
    if (!won) throw new ApiError(409, 'This item is no longer available');
    const [request] = await BorrowRequest.create([{ ...base, status: 'approved' }], { session });
    return request;
  });
};

exports.approve = (user, id) =>
  withTxn(async (session) => {
    const r = await BorrowRequest.findOne({ _id: id, ownerId: user._id }).session(session);
    if (!r) throw new ApiError(404, 'Request not found');
    if (r.type !== 'borrow' || r.status !== 'pending') throw new ApiError(409, `A ${r.status} request cannot be approved`);
    if (r.startDate < today()) throw new ApiError(409, 'The start date has already passed');

    const locked = await Item.findOneAndUpdate({ _id: r.itemId, listingStatus: 'available' }, { $inc: { bookingSeq: 1 } }, { session });
    if (!locked) throw new ApiError(409, 'This item is not available');

    const clash = await BorrowRequest.findOne({
      itemId: r.itemId,
      _id: { $ne: r._id },
      status: { $in: ['approved', 'active', 'overdue'] },
      startDate: { $lte: r.endDate },
      endDate: { $gte: r.startDate },
    }).session(session);
    if (clash) throw new ApiError(409, `Overlaps an approved booking (${iso(clash.startDate)} to ${iso(clash.endDate)})`);

    const approved = await BorrowRequest.findOneAndUpdate(
      { _id: r._id, status: 'pending' },
      { status: 'approved', reviewedBy: user._id, reviewedAt: new Date() },
      { returnDocument: 'after', session }
    );
    if (!approved) throw new ApiError(409, 'This request just changed, please refresh');
    return approved;
  });

exports.reject = async (user, id) => {
  const r = await BorrowRequest.findOne({ _id: id, ownerId: user._id });
  if (!r) throw new ApiError(404, 'Request not found');
  const rejected = await BorrowRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { status: 'rejected', reviewedBy: user._id, reviewedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!rejected) throw new ApiError(409, `A ${r.status} request cannot be rejected`);
  return rejected;
};

exports.cancel = async (user, id) => {
  const request = await BorrowRequest.findById(id);
  const isBorrower = request?.borrowerId.equals(user._id);
  const isOwner = request?.ownerId.equals(user._id);
  if (!isBorrower && !isOwner) throw new ApiError(404, 'Request not found');

  const cancellable = isBorrower ? ['pending', 'approved'] : ['approved'];
  return withTxn(async (session) => {
    const cancelled = await BorrowRequest.findOneAndUpdate(
      { _id: id, status: { $in: cancellable } },
      { status: 'cancelled', cancelledBy: user._id },
      { returnDocument: 'after', session }
    );
    if (!cancelled) throw new ApiError(409, `A ${request.status} request cannot be cancelled`);
    if (cancelled.type !== 'borrow')
      await Item.updateOne({ _id: cancelled.itemId, listingStatus: 'reserved' }, { listingStatus: 'available' }, { session });
    return cancelled;
  });
};
