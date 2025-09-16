const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String }, // null or empty means group chat
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
