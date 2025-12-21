const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  plan: { type: String, default: 'free' },
  stars: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referralCount: { type: Number, default: 0 },
  referrerId: String,
  theme: { type: String, default: 'midnight' },
  banned: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
