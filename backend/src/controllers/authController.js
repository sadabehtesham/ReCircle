const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
};

const sendToken = (res, user, status = 200) => {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res
    .cookie('token', token, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .status(status)
    .json({ success: true, data: { user } });
};

exports.register = async (req, res) => {
  const { password, ...fields } = req.body;
  const user = await User.create({ ...fields, passwordHash: await bcrypt.hash(password, 10) });
  sendToken(res, user, 201);
};

exports.login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(req.body.password)))
    throw new ApiError(401, 'Invalid email or password');
  if (user.accountStatus !== 'active') throw new ApiError(403, 'Account suspended');
  sendToken(res, user);
};

exports.logout = (req, res) => {
  res.clearCookie('token', base).json({ success: true, data: null });
};

exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });
