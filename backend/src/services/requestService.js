const Item = require('../models/Item');
const BorrowRequest = require('../models/BorrowRequest');
const ApiError = require('../utils/ApiError');

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
    try {
      return await BorrowRequest.create({ ...base, startDate, endDate });
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'You already have an open request for this item');
      throw error;
    }
  }

  const won = await Item.findOneAndUpdate(
    { _id: item._id, listingStatus: 'available' },
    { listingStatus: 'reserved' }
  );
  if (!won) throw new ApiError(409, 'This item is no longer available');
  try {
    return await BorrowRequest.create({ ...base, status: 'approved' });
  } catch (error) {
    await Item.updateOne({ _id: item._id }, { listingStatus: 'available' });
    throw error;
  }
};

exports.cancel = async (user, id) => {
  const request = await BorrowRequest.findById(id);
  const isBorrower = request?.borrowerId.equals(user._id);
  const isOwner = request?.ownerId.equals(user._id);
  if (!isBorrower && !isOwner) throw new ApiError(404, 'Request not found');

  const cancellable = isBorrower ? ['pending', 'approved'] : ['approved'];
  const cancelled = await BorrowRequest.findOneAndUpdate(
    { _id: id, status: { $in: cancellable } },
    { status: 'cancelled', cancelledBy: user._id },
    { returnDocument: 'after' }
  );
  if (!cancelled) throw new ApiError(409, `A ${request.status} request cannot be cancelled`);

  if (cancelled.type !== 'borrow')
    await Item.updateOne({ _id: cancelled.itemId, listingStatus: 'reserved' }, { listingStatus: 'available' });
  return cancelled;
};
