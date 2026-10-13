const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

exports.protect = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) throw new ApiError(401, 'Not authenticated');

  let id;
  try {
    ({ id } = jwt.verify(token, process.env.JWT_SECRET));
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(id);
  if (!user || user.accountStatus !== 'active') throw new ApiError(401, 'Not authenticated');
  req.user = user;
  next();
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new ApiError(403, 'Forbidden'));
