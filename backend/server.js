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
  password: { type: String, required: true }
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
    enum: ['Fixed', 'Replaced Terminal', 'Pending Part'], 
    default: 'Fixed' 
  },
  repairDate: { type: String, required: true } // YYYY-MM-DD
}, { timestamps: true });

const Repair = mongoose.model('Repair', RepairSchema);

// Weekly Transport Allowance Tracker Schema
const TransportSchema = new mongoose.Schema({
  techId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStartDate: { type: String, required: true }, // YYYY-MM-DD (Monday)
  transportDays: {
    Mon: { type: Boolean, default: false },
    Tue: { type: Boolean, default: false },
    Wed: { type: Boolean, default: false },
    Thu: { type: Boolean, default: false },
    Fri: { type: Boolean, default: false }
  }
}, { timestamps: true });

const Transport = mongoose.model('Transport', TransportSchema);

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

const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

/* -------------------------------------------------------------------------- */
/*                                AUTH ROUTES                                 */
/* -------------------------------------------------------------------------- */

// Register Technician (Auto-generates Tech ID)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Full name and password are required' });
    }

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const techId = `TECH-${randomDigits}`;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, techId, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ 
      message: 'Technician account created successfully', 
      techId: techId 
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
    res.json({ token, user: { name: user.name, techId: user.techId } });
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
      status: status || 'Fixed',
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

    const todayRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: today
    });

    const weeklyRepairsCount = await Repair.countDocuments({
      techId: userId,
      repairDate: { $gte: startOfWeek }
    });

    const recentRepairs = await Repair.find({ techId: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    let transportLog = await Transport.findOne({ techId: userId, weekStartDate: startOfWeek });
    if (!transportLog) {
      transportLog = new Transport({ techId: userId, weekStartDate: startOfWeek });
      await transportLog.save();
    }

    res.json({
      todayRepairsCount,
      weeklyRepairsCount,
      recentRepairs,
      transportDays: transportLog.transportDays
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
    const { transportDays } = req.body;

    const updatedTransport = await Transport.findOneAndUpdate(
      { techId: userId, weekStartDate: startOfWeek },
      { $set: { transportDays } },
      { new: true, upsert: true }
    );

    res.json({ success: true, transportDays: updatedTransport.transportDays });
  } catch (error) {
    res.status(500).json({ message: 'Error updating transport allowance', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Moniepoint Tech Portal running on port ${PORT}`));
