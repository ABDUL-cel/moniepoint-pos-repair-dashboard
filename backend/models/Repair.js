const mongoose = require('mongoose');

const RepairSchema = new mongoose.Schema({
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serialNumber: { type: String, required: true },
  merchantName: { type: String, required: true },
  faultType: { 
    type: String, 
    enum: ['Screen/Display', 'Battery/Charging', 'Network/SIM', 'OS/Software Reflash', 'Keypad/Printer'],
    required: true 
  },
  status: { type: String, enum: ['Fixed', 'Replaced', 'Pending Part'], default: 'Fixed' },
  repairDate: { type: String, required: true } // YYYY-MM-DD
}, { timestamps: true });

module.exports = mongoose.model('Repair', RepairSchema);
