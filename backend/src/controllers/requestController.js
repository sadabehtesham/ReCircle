const BorrowRequest = require('../models/BorrowRequest');
const service = require('../services/requestService');

exports.create = async (req, res) => {
  const request = await service.create(req.user, req.body);
  res.status(201).json({ success: true, data: { request } });
};

const act = (name) => async (req, res) => {
  const request = await service[name](req.user, req.params.id);
  res.json({ success: true, data: { request } });
};
exports.cancel = act('cancel');
exports.approve = act('approve');
exports.reject = act('reject');

exports.list = async (req, res) => {
  const { role, status, itemId, page, limit } = req.valid;
  const filter = { [role === 'owner' ? 'ownerId' : 'borrowerId']: req.user._id, ...(status && { status }), ...(itemId && { itemId }) };
  const [requests, total] = await Promise.all([
    BorrowRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('itemId', 'title images lendingType price')
      .populate('borrowerId', 'name college profileImage')
      .populate('ownerId', 'name college profileImage'),
    BorrowRequest.countDocuments(filter),
  ]);
  res.json({ success: true, data: { requests, page, limit, total, pages: Math.ceil(total / limit) } });
};
