require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected: Moniepoint Tech Portal'))
  .catch(err => console.error('MongoDB Connection Error:', err));

/* -------------------------------------------------------------------------- */
/*                               MONGOOSE SCHEMAS                             */
/* -------------------------------------------------------------------------- */

// Technician Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  techId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  transportRate: { type: Number, default: 4000 }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Terminal Repair Log Schema
const RepairSchema = new mongoose.Schema({
  techId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serialNumber: { type: String, required: true, uppercase: true, trim: true },
  merchantName: { type: String, required: true, trim: true },
  faultType: { 
    type: String, 
    enum: [
      // Frontend HTML Select Options
      'Battery/Power Defect',
      'Screen/Display Damage',
      'Printer/Paper Jam',
      'Network/SIM Slot Issue',
      'Keypad/Button Failure',
      'Software/OS Corruption',
      // Legacy Schema Options
      'Battery / Charging Port',
      'Screen / Display',
      'Network / SIM Slot',
      'OS / App Software Reflash',
      'Keypad / Printer Hardware'
    ],
    required: true 
  },
  status: { 
    type: String, 
    enum: [
      'Repaired & Tested',
      'Fixed',
      'Replaced Terminal', 
      'Pending Part'
    ], 
    default: 'Repaired & Tested' 
  },
  repairDate: { type: String, required: true } // YYYY-MM-DD
}, { timestamps: true });

const Repair = mongoose.model('Repair', RepairSchema);

// Weekly Transport Allowance Tracker Schema
const TransportSchema = new mongoose.Schema({
  techId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStartDate: { type: String, required: true }, // YYYY-MM-DD (Monday)
  transportRate: { type: Number, default: 4000 },
  transportDays: {
    Mon: { type: Boolean, default: false },
    Tue: { type: Boolean, default: false },
    Wed: { type: Boolean, default: false },
    Thu: { type: Boolean, default: false },
    Fri: { type: Boolean, default: false }
  }
}, { timestamps: true });

const Transport = mongoose.model('Transport', TransportSchema);

// Monthly Pay Tracker Schema (Missed Weeks)
const MonthlyTrackerSchema = new mongoose.Schema({
  techId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monthKey: { type: String, required: true }, // YYYY-MM
  missedWeeks: { type: Number, default: 0, min: 0, max: 4 }
}, { timestamps: true });

const MonthlyTracker = mongoose.model('MonthlyTracker', MonthlyTrackerSchema);

/* -------------------------------------------------------------------------- */
/*                           HELPER FUNCTIONS & AUTH                          */
/* -------------------------------------------------------------------------- */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Token Required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const getMonthKey = () => new Date().toISOString().slice(0, 7);

const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const getStartOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const getStartOfYear = () => {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
};

/* -------------------------------------------------------------------------- */
/*                                AUTH ROUTES                                 */
/* -------------------------------------------------------------------------- */

// Register Technician
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, password, transportRate, transportDays } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Full name and password are required' });
    }

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const techId = `TECH-${randomDigits}`;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      name, 
      techId, 
      password: hashedPassword,
      transportRate: transportRate || 4000
    });
    await newUser.save();

    // Create Initial Transport Setting for current week
    const startOfWeek = getStartOfWeek();
    if (transportDays) {
      const transportLog = new Transport({
        techId: newUser._id,
        weekStartDate: startOfWeek,
        transportRate: transportRate || 4000,
        transportDays
      });
      await transportLog.save();
    }

    const token = jwt.sign(
      { id: newUser._id, techId: newUser.techId, name: newUser.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      message: 'Technician account created successfully', 
      token,
      techId: techId,
      user: { name: newUser.name, techId: newUser.techId, transportRate: newUser.transportRate }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// Login Technician
app.post('/api/auth/login', async (req, res) => {
  try {
    const { techId, password } = req.body;
    
    const user = await User.findOne({ techId });
    if (!user) return res.status(400).json({ message: 'Invalid Technician ID or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Technician ID or password' });

    const token = jwt.sign(
      { id: user._id, techId: user.techId, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    res.json({ token, user: { name: user.name, techId: user.techId, transportRate: user.transportRate } });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                           TECHNICIAN REPAIR ROUTES                         */
/* -------------------------------------------------------------------------- */

// Log a New Terminal Repair
app.post('/api/repairs/log', authenticateToken, async (req, res) => {
  try {
    const { serialNumber, merchantName, faultType, status } = req.body;
    const today = getTodayDate();

    if (!serialNumber || !merchantName || !faultType) {
      return res.status(400).json({ message: 'Serial number, merchant name, and fault type are required.' });
    }

    const repair = new Repair({
      techId: req.user.id,
      serialNumber,
      merchantName,
      faultType,
      status: status || 'Repaired & Tested',
      repairDate: today
    });

    await repair.save();
    res.status(201).json({ message: 'POS Repair documented successfully', repair });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record repair log', error: error.message });
  }
});

// Fetch Dashboard Metrics & Recent Repairs
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();
    const startOfWeek = getStartOfWeek();
    const startOfMonth = getStartOfMonth();
    const startOfYear = getStartOfYear();
    const monthKey = getMonthKey();

    const todayRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: today
    });

    const weeklyRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: { $gte: startOfWeek }
    });

    const monthlyRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: { $gte: startOfMonth }
    });

    const yearlyRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: { $gte: startOfYear }
    });

    const recentRepairs = await Repair.find({ techId: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    let transportLog = await Transport.findOne({ techId: userId, weekStartDate: startOfWeek });
    if (!transportLog) {
      const user = await User.findById(userId);
      transportLog = new Transport({ 
        techId: userId, 
        weekStartDate: startOfWeek,
        transportRate: user ? user.transportRate : 4000
      });
      await transportLog.save();
    }

    let monthlyTracker = await MonthlyTracker.findOne({ techId: userId, monthKey });
    if (!monthlyTracker) {
      monthlyTracker = new MonthlyTracker({ techId: userId, monthKey, missedWeeks: 0 });
      await monthlyTracker.save();
    }

    res.json({
      todayRepairsCount,
      weeklyRepairsCount,
      monthlyRepairsCount,
      yearlyRepairsCount,
      recentRepairs,
      transportDays: transportLog.transportDays,
      transportRate: transportLog.transportRate,
      missedWeeks: monthlyTracker.missedWeeks
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

// Update Weekly Transport Allowance
app.post('/api/transport/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const startOfWeek = getStartOfWeek();
    const { transportDays, transportRate } = req.body;

    const updateFields = {};
    if (transportDays) updateFields.transportDays = transportDays;
    if (transportRate !== undefined) updateFields.transportRate = transportRate;

    const updatedTransport = await Transport.findOneAndUpdate(
      { techId: userId, weekStartDate: startOfWeek },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    if (transportRate !== undefined) {
      await User.findByIdAndUpdate(userId, { transportRate });
    }

    res.json({ 
      success: true, 
      transportDays: updatedTransport.transportDays,
      transportRate: updatedTransport.transportRate 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating transport allowance', error: error.message });
  }
});

// Update Missed Weeks Tracker
app.post('/api/monthly/missed-weeks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const monthKey = getMonthKey();
    const { missedWeeks } = req.body;

    const updatedTracker = await MonthlyTracker.findOneAndUpdate(
      { techId: userId, monthKey },
      { $set: { missedWeeks } },
      { new: true, upsert: true }
    );

    res.json({ success: true, missedWeeks: updatedTracker.missedWeeks });
  } catch (error) {
    res.status(500).json({ message: 'Error updating monthly tracker', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Moniepoint Tech Portal running on port ${PORT}`));
