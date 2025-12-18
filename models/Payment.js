const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  plan: { type: String, required: true }, // 'standard' yoki 'premium'
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // 'pending', 'approved', 'rejected'
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);