const Item = require('../models/Item');
const BorrowRequest = require('../models/BorrowRequest');
const ApiError = require('../utils/ApiError');
const images = require('../services/images');
const { OPEN_STATUSES } = require('../utils/constants');

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, title: { title: 1 } };
const OWNER_FIELDS = 'name college profileImage';
const ids = (list) => list.map((image) => image.publicId);

const findOwned = async (req) => {
  const item = await Item.findOne({ _id: req.params.id, listingStatus: { $ne: 'removed' } });
  if (!item) throw new ApiError(404, 'Item not found');
  if (!item.ownerId.equals(req.user._id)) throw new ApiError(403, 'You can only change your own listings');
  if (!['available', 'unavailable'].includes(item.listingStatus))
    throw new ApiError(409, 'This listing is in a transaction and cannot be changed');
  if (await BorrowRequest.exists({ itemId: item._id, status: { $in: OPEN_STATUSES } }))
    throw new ApiError(409, 'This listing has open requests and cannot be changed');
  return item;
};

exports.list = async (req, res) => {
  const { search, category, condition, lendingType, sort, page, limit } = req.valid;
  const filter = {
    listingStatus: 'available',
    ...(category && { category }),
    ...(condition && { condition }),
    ...(lendingType && { lendingType }),
  };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }
  const [items, total] = await Promise.all([
    Item.find(filter)
      .sort({ ...SORTS[sort], _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('ownerId', OWNER_FIELDS),
    Item.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.mine = async (req, res) => {
  const { page, limit } = req.valid;
  const filter = { ownerId: req.user._id, listingStatus: { $ne: 'removed' } };
  const [items, total] = await Promise.all([
    Item.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('ownerId', OWNER_FIELDS),
    Item.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items, page, limit, total, pages: Math.ceil(total / limit) } });
};

exports.getOne = async (req, res) => {
  const item = await Item.findOne({ _id: req.params.id, listingStatus: { $ne: 'removed' } }).populate('ownerId', OWNER_FIELDS);
  if (!item) throw new ApiError(404, 'Item not found');
  res.json({ success: true, data: { item } });
};

exports.create = async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, 'At least one photo is required');
  const uploaded = await images.uploadAll(req.files, 'items');
  try {
    const item = await Item.create({ ...req.body, images: uploaded, ownerId: req.user._id });
    res.status(201).json({ success: true, data: { item } });
  } catch (error) {
    await images.removeAll(ids(uploaded));
    throw error;
  }
};

exports.update = async (req, res) => {
  const item = await findOwned(req);
  const { removeImages, ...fields } = req.body;
  if (fields.price !== undefined && item.lendingType !== 'sell') throw new ApiError(400, 'Only items for sale have a price');
  const gone = item.images.filter((image) => removeImages.includes(image.publicId));
  const keep = item.images.filter((image) => !removeImages.includes(image.publicId));
  const total = keep.length + (req.files?.length ?? 0);
  if (total < 1) throw new ApiError(400, 'At least one photo is required');
  if (total > 5) throw new ApiError(400, 'A listing can have at most 5 photos');

  const added = await images.uploadAll(req.files, 'items');
  item.set({ ...fields, images: [...keep, ...added] });
  try {
    await item.save();
  } catch (error) {
    await images.removeAll(ids(added));
    throw error;
  }
  await images.removeAll(ids(gone));
  res.json({ success: true, data: { item } });
};

exports.remove = async (req, res) => {
  const item = await findOwned(req);
  item.listingStatus = 'removed';
  await item.save();
  res.json({ success: true, data: null });
};
