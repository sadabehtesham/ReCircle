const BorrowRequest = require('../models/BorrowRequest');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const ApiError = require('../utils/ApiError');
const withTxn = require('../utils/transaction');
const { today, DAY } = require('../utils/dates');

const loadAsOwner = async (user, id, session) => {
  const request = await BorrowRequest.findById(id).session(session);
  if (!request || ![request.ownerId, request.borrowerId].some((participant) => participant.equals(user._id)))
    throw new ApiError(404, 'Request not found');
  if (!request.ownerId.equals(user._id)) throw new ApiError(403, 'Only the owner can confirm this');
  return request;
};

exports.handover = (user, id, { condition, paymentReceived }) =>
  withTxn(async (session) => {
    const request = await loadAsOwner(user, id, session);
    if (request.status !== 'approved')
      throw new ApiError(409, `A ${request.status} request cannot be handed over`);

    const isBorrow = request.type === 'borrow';
    if (isBorrow && today() > request.endDate)
      throw new ApiError(409, 'This booking has ended. Cancel it instead.');
    if (request.type === 'sell' && paymentReceived !== true)
      throw new ApiError(400, 'Confirm that you received the payment');

    const item = await Item.findById(request.itemId).session(session);
    if (!item) throw new ApiError(404, 'Item not found');
    const now = new Date();
    const updatedRequest = await BorrowRequest.findOneAndUpdate(
      { _id: request._id, status: 'approved' },
      { status: isBorrow ? 'active' : 'completed' },
      { returnDocument: 'after', session }
    );
    if (!updatedRequest) throw new ApiError(409, 'This request just changed, please refresh');
    if (!isBorrow) {
      const result = await Item.updateOne(
        { _id: request.itemId, listingStatus: 'reserved' },
        { listingStatus: 'closed' },
        { session }
      );
      if (result.matchedCount !== 1) throw new ApiError(409, 'This item is no longer reserved');
    }

    const [transaction] = await Transaction.create(
      [
        {
          requestId: request._id,
          itemId: request.itemId,
          ownerId: request.ownerId,
          borrowerId: request.borrowerId,
          type: request.type,
          pickupAt: now,
          currentStatus: isBorrow ? 'active' : 'completed',
          handedOverBy: user._id,
          ...(condition && { conditionBefore: condition }),
          ...(isBorrow ? { dueAt: new Date(request.endDate.getTime() + DAY) } : { completedAt: now }),
          ...(request.type === 'sell' && { price: item.price, paymentReceivedAt: now }),
        },
      ],
      { session }
    );
    return { request: updatedRequest, transaction };
  });

exports.handback = (user, id, { condition }) =>
  withTxn(async (session) => {
    const request = await loadAsOwner(user, id, session);
    if (request.type !== 'borrow' || request.status !== 'active')
      throw new ApiError(409, `A ${request.status} request cannot be returned`);

    const now = new Date();
    const updatedRequest = await BorrowRequest.findOneAndUpdate(
      { _id: request._id, status: 'active' },
      { status: 'returned' },
      { returnDocument: 'after', session }
    );
    if (!updatedRequest) throw new ApiError(409, 'This request just changed, please refresh');

    const transaction = await Transaction.findOneAndUpdate(
      { requestId: request._id, currentStatus: 'active' },
      {
        currentStatus: 'completed',
        returnedAt: now,
        completedAt: now,
        returnConfirmedBy: user._id,
        ...(condition && { conditionAfter: condition }),
      },
      { returnDocument: 'after', session }
    );
    if (!transaction) throw new ApiError(409, 'This loan has no active transaction');
    await Item.updateOne({ _id: request.itemId }, { listingStatus: 'closed' }, { session });
    return { request: updatedRequest, transaction };
  });
