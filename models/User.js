const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },

  plan: { type: String, default: 'free' },
  stars: { type: Number, default: 0 },

  referralCount: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referrerId: { type: Number, default: null },

  theme: { type: String, default: 'midnight' },

  isAdmin: { type: Boolean, default: false }, 
  banned: { type: Boolean, default: false },  

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
