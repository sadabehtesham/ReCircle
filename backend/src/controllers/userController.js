const User = require('../models/User');
const Item = require('../models/Item');
const ApiError = require('../utils/ApiError');
const images = require('../services/images');

exports.getPublic = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, accountStatus: 'active' })
    .select('name college profileImage createdAt');
  if (!user) throw new ApiError(404, 'User not found');
  const items = await Item.find({ ownerId: user._id, listingStatus: 'available' })
    .sort({ createdAt: -1 })
    .limit(24)
    .populate('ownerId', 'name college profileImage');
  res.json({ success: true, data: { user, items } });
};

exports.updateMe = async (req, res) => {
  const user = req.user;
  user.set(req.body);
  const oldId = user.profileImageId;
  let added;
  if (req.file) {
    [added] = await images.uploadAll([req.file], 'avatars');
    user.profileImage = added.url;
    user.profileImageId = added.publicId;
  }
  try {
    await user.save();
  } catch (error) {
    if (added) await images.removeAll([added.publicId]);
    throw error;
  }
  if (added && oldId) await images.removeAll([oldId]);
  res.json({ success: true, data: { user } });
};
