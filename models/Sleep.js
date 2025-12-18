const mongoose = require('mongoose');

const sleepSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  sleepData: { type: Object, default: {} },  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sleep', sleepSchema);
