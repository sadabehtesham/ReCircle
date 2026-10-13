const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    college: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    profileImage: { type: String, default: '' },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = model('User', userSchema);
