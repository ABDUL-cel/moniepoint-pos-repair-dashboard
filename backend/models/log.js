const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  posCount: { type: Number, default: 0 },
  transportDays: {
    Mon: { type: Boolean, default: false },
    Tue: { type: Boolean, default: false },
    Wed: { type: Boolean, default: false },
    Thu: { type: Boolean, default: false },
    Fri: { type: Boolean, default: false }
  }
}, { timestamps: true });

// Ensure unique log per user per day
LogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Log', LogSchema);
