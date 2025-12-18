const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  habits: { type: Array, default: [] },  
  trackerData: { type: Object, default: {} }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Habit', habitSchema);
