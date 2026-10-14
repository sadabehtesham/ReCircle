const Transaction = require('../models/Transaction');

exports.list = async (req, res) => {
  const { role, status, page, limit } = req.valid;
  const filter = { [role === 'owner' ? 'ownerId' : 'borrowerId']: req.user._id, currentStatus: status };
  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('itemId', 'title images lendingType')
      .populate('borrowerId', 'name college profileImage')
      .populate('ownerId', 'name college profileImage'),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, data: { transactions, page, limit, total, pages: Math.ceil(total / limit) } });
};
